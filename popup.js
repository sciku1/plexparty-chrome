"use strict";

$(function () {
  var getURLParameter = function (url, key) {
    var searchString = "?" + url.split("?")[1];
    if (searchString === undefined) {
      return null;
    }
    var escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    var regex = new RegExp("[?|&]" + escapedKey + "=" + "([^&]*)(&|$)");
    var match = regex.exec(searchString);
    if (match === null) {
      return null;
    }
    return decodeURIComponent(match[1]);
  };

  //////////////////////
  // get the current tab
  //////////////////////
  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    function (tabs) {
      // error handling
      var showError = function (err) {
        $(".some-error").removeClass("hidden");
        $(".no-error").addClass("hidden");
        $("#error-msg").html(err);
      };

      $("#close-error").click(function () {
        $(".no-error").removeClass("hidden");
        $(".some-error").addClass("hidden");
      });

      // set up the spinner
      var startSpinning = function () {
        $("#control-lock").prop("disabled", true);
        $("#create-session").prop("disabled", true);
        $("#leave-session").prop("disabled", true);
      };

      var stopSpinning = function () {
        $("#control-lock").prop("disabled", false);
        $("#create-session").prop("disabled", false);
        $("#leave-session").prop("disabled", false);
      };

      const loadLibraries = (tabId, libs, callback) => {
        const exec = (index) => {
          if (index >= libs.length) {
            return callback();
          }
          chrome.tabs.executeScript(
            tabId,
            {
              file: libs[index],
            },
            () => exec(index + 1)
          );
        };
        exec(0);
      };
      // send a message to the content script
      var sendMessage = function (type, data, callback) {
        startSpinning();
        loadLibraries(
          tabs[0].id,
          [
            "libs/jquery.js",
            "libs/socketio.js",
            "libs/pnglib.js",
            "libs/sha256.js",
            "libs/identicon.js",
            "content_script.js",
          ],
          function () {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                type: type,
                data: data,
              },
              function (response) {
                stopSpinning();
                if (response.errorMessage) {
                  showError(response.errorMessage);
                  return;
                }
                if (callback) {
                  callback(response);
                }
              }
            );
          }
        );
      };

      // connected/disconnected state
      var showConnected = function (sessionId) {
        var urlWithSessionId =
          tabs[0].url +
          (tabs[0].url.indexOf("?") > -1 ? "&" : "?") +
          "ppSessionId=" +
          encodeURIComponent(sessionId);
        $(".disconnected").addClass("hidden");
        $(".connected").removeClass("hidden");
        $("#show-chat").prop("checked", true);
        $("#share-url").val(urlWithSessionId).focus().select();
      };

      var showDisconnected = function () {
        $(".disconnected").removeClass("hidden");
        $(".connected").addClass("hidden");
        $("#control-lock").prop("checked", false);
      };

      // get the session if there is one
      sendMessage(
        "getInitData",
        {
          version: chrome.app.getDetails().version,
        },
        function (initData) {
          // From the URL, parse the server ID
          const serverId = tabs[0].url.match(/desktop#!\/server\/(.*)\//)[1];
          // parse the video ID from the URL
          const videoKeyId = getURLParameter(tabs[0].url, "key");

          const context = getURLParameter(tabs[0].url, "context");
          // initial state
          if (initData.errorMessage) {
            showError(initData.errorMessage);
            return;
          }
          if (initData.sessionId === null) {
            var sessionIdFromUrl = getURLParameter(tabs[0].url, "ppSessionId");
            if (sessionIdFromUrl) {
              sendMessage(
                "joinSession",
                {
                  sessionId: sessionIdFromUrl
                    .replace(/^\s+|\s+$/g, "")
                    .toLowerCase(),
                  videoKeyId: videoKeyId,
                },
                function (response) {
                  showConnected(sessionIdFromUrl);
                }
              );
            }
          } else {
            showConnected(initData.sessionId);
          }
          $("#show-chat").prop("checked", initData.chatVisible);

          // listen for clicks on the "Create session" button
          $("#create-session").click(function () {
            sendMessage(
              "createSession",
              {
                controlLock: $("#control-lock").is(":checked"),
                serverId,
                videoKeyId,
              },
              function (response) {
                showConnected(response.sessionId);
              }
            );
          });

          // listen for clicks on the "Leave session" button
          $("#leave-session").click(function () {
            sendMessage("leaveSession", {}, function (response) {
              showDisconnected();
            });
          });

          // listen for clicks on the "Show chat" checkbox
          $("#show-chat").change(function () {
            sendMessage(
              "showChat",
              { visible: $("#show-chat").is(":checked") },
              null
            );
          });

          // listen for clicks on the share URL box
          $("#share-url").click(function (e) {
            e.stopPropagation();
            e.preventDefault();
            $("#share-url").select();
          });

          // listen for clicks on the "Copy URL" link
          $("#copy-btn").click(function (e) {
            e.stopPropagation();
            e.preventDefault();
            $("#share-url").select();
            document.execCommand("copy");
          });
        }
      );
    }
  );
});
