// can't use strict mode for this file because of socket.io

(function () {
  // make sure the content script is only run once on the page
  if (!window.plexPartyLoaded) {
    window.plexPartyLoaded = true;

    //////////////////////////////////////////////////////////////////////////
    // Version                                                              //
    //////////////////////////////////////////////////////////////////////////

    var version = null;

    //////////////////////////////////////////////////////////////////////////
    // Helpers                                                              //
    //////////////////////////////////////////////////////////////////////////

    // Extract the key
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

    // returns an action which delays for some time
    var delay = function (milliseconds) {
      return function (result) {
        return new Promise(function (resolve, reject) {
          setTimeout(function () {
            resolve(result);
          }, milliseconds);
        });
      };
    };

    // returns an action which waits until the condition thunk returns true,
    // rejecting if maxDelay time is exceeded
    var delayUntil = function (condition, maxDelay) {
      return function (result) {
        var delayStep = 250;
        var startTime = new Date().getTime();
        var checkForCondition = function () {
          if (condition()) {
            return Promise.resolve(result);
          }
          if (
            maxDelay !== null &&
            new Date().getTime() - startTime > maxDelay
          ) {
            return Promise.reject(Error("delayUntil timed out"));
          }
          return delay(delayStep)().then(checkForCondition);
        };
        return checkForCondition();
      };
    };

    // add value to the end of array, and remove items from the beginning
    // such that the length does not exceed limit
    var shove = function (array, value, limit) {
      array.push(value);
      if (array.length > limit) {
        array.splice(0, array.length - limit);
      }
    };

    // compute the mean of an array of numbers
    var mean = function (array) {
      return (
        array.reduce(function (a, b) {
          return a + b;
        }) / array.length
      );
    };

    // compute the median of an array of numbers
    var median = function (array) {
      return array.concat().sort()[Math.floor(array.length / 2)];
    };

    // swallow any errors from an action
    // and log them to the console
    var swallow = function (action) {
      return function (result) {
        return action(result).catch(function (e) {
          console.error(e);
        });
      };
    };

    // promise.ensure(fn) method
    // note that this method will not swallow errors
    Promise.prototype.ensure = function (fn) {
      return this.then(fn, function (e) {
        fn();
        throw e;
      });
    };

    //////////////////////////////////////////////////////////////////////////
    // Plex API                                                             //
    //////////////////////////////////////////////////////////////////////////

    // how many simulated UI events are currently going on
    // don't respond to UI events unless this is 0, otherwise
    // we will mistake simulated actions for real ones
    var uiEventsHappening = 0;

    // video duration in milliseconds
    var lastDuration = 60 * 60 * 1000;
    var getDuration = function () {
      var video = document.querySelector("video");
      if (video.length > 0) {
        lastDuration = Math.floor(video.duration * 1000);
      }
      return lastDuration;
    };

    // 'playing', 'paused', 'loading', or 'idle'
    var getState = function () {
      const videoElement = document.querySelector("video");

      if (!videoElement || videoElement.readyState <= 2) {
        return "loading";
      }
      if (!videoElement.paused) {
        return "playing";
      } else {
        return "paused";
      }
    };

    // current playback position in milliseconds
    var getPlaybackPosition = function () {
      return document.querySelector("video").currentTime > 0
        ? Math.round(document.querySelector("video").currentTime) * 1000
        : 0;
    };

    // wake up from idle mode
    var wakeUp = function () {
      uiEventsHappening += 1;
      // I don't think we need a replacement to this line
      // jQuery(".timeout-wrapper.player-active .icon-play").click();
      return delayUntil(function () {
        return getState() !== "idle";
      }, 2500)().ensure(function () {
        uiEventsHappening -= 1;
      });
    };

    // show the playback controls
    var showControls = function () {
      uiEventsHappening += 1;
      var scrubber = jQuery("#scrubber-component");
      var eventOptions = {
        bubbles: true,
        button: 0,
        currentTarget: scrubber[0],
      };
      scrubber[0].dispatchEvent(new MouseEvent("mousemove", eventOptions));
      return delayUntil(function () {
        return scrubber.is(":visible");
      }, 1000)().ensure(function () {
        uiEventsHappening -= 1;
      });
    };

    // hide the playback controls
    var hideControls = function () {
      uiEventsHappening += 1;
      var player = jQuery("#netflix-player");
      var mouseX = 100; // relative to the document
      var mouseY = 100; // relative to the document
      var eventOptions = {
        bubbles: true,
        button: 0,
        screenX: mouseX - jQuery(window).scrollLeft(),
        screenY: mouseY - jQuery(window).scrollTop(),
        clientX: mouseX - jQuery(window).scrollLeft(),
        clientY: mouseY - jQuery(window).scrollTop(),
        offsetX: mouseX - player.offset().left,
        offsetY: mouseY - player.offset().top,
        pageX: mouseX,
        pageY: mouseY,
        currentTarget: player[0],
      };
      player[0].dispatchEvent(new MouseEvent("mousemove", eventOptions));
      return delay(1)().ensure(function () {
        uiEventsHappening -= 1;
      });
    };
    var isPlaying = (vid) =>
      vid.currentTime > 0 && !vid.paused && !vid.ended && vid.readyState > 2;
    // pause
    var pause = function () {
      uiEventsHappening += 1;
      document.querySelector("video").pause();
      console.log("pause()");
      uiEventsHappening -= 1;
      return Promise.resolve();
    };

    // play
    var play = function () {
      uiEventsHappening += 1;
      const vid = document.querySelector("video");
      if (!isPlaying(vid)) {
        document.querySelector("video").play();
      }

      uiEventsHappening -= 1;
      return Promise.resolve();
    };

    // freeze playback for some time and then play
    var freeze = function (milliseconds) {
      return function () {
        console.log("freeze(" + milliseconds + ")");
        const vid = document.querySelector("video");
        uiEventsHappening += 1;
        vid.pause();
        vid.currentTime = milliseconds / 1000;
        uiEventsHappening -= 1;
        return Promise.resolve();
      };
    };

    // jump to a specific time in the video
    var seek = function (milliseconds) {
      return function () {
        console.log("seek(" + milliseconds + ")");
        uiEventsHappening += 1;
        document.querySelector("video").currentTime = milliseconds / 1000;
        uiEventsHappening -= 1;
        return Promise.resolve();
      };
    };

    //////////////////////////////////////////////////////////////////////////
    // Socket                                                               //
    //////////////////////////////////////////////////////////////////////////

    // Development
    var SERVER_URL = "http://localhost:3000/";
    // Production
    // var SERVER_URL = "https://netflixparty-server.herokuapp.com";

    // connection to the server
    var socket = io(SERVER_URL);

    // get the userId from the server
    var userId = null;
    socket.on("userId", function (data) {
      if (userId === null) {
        userId = data;
      }
    });

    //////////////////////////////////////////////////////////////////////////
    // Chat API                                                             //
    //////////////////////////////////////////////////////////////////////////

    // chat state
    var messages = [];
    var unreadCount = 0;
    var originalTitle = document.title;

    // UI constants
    var chatSidebarWidth = 360;
    var chatSidebarPadding = 16;
    var avatarSize = 20;
    var avatarPadding = 4;
    var avatarBorder = 2;
    var chatVericalMargin = 4;
    var chatInputBorder = 2;
    var chatMessageHorizontalPadding = 8;
    var chatMessageVerticalPadding = 8;
    var presenceIndicatorHeight = 30;

    // this is the markup that needs to be injected onto the page for chat
    var chatHtml = `
      <style>
        [class^="AudioVideoPlayerView-container"].with-chat {
          width: calc(100% - ${chatSidebarWidth}px) !important;
        }

        #chat-container, #chat-container * {
          box-sizing: border-box;
        }

        #chat-container {
          width: ${chatSidebarWidth}px;
          height: 100%;
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          cursor: auto;
          user-select: text;
          -webkit-user-select: text;
          z-index: 9999999999;
          padding: ${chatSidebarPadding}px;
        }

        #chat-container #chat-history-container {
          height: calc(100% - ${
            chatMessageVerticalPadding * 2 +
            avatarSize +
            avatarPadding * 2 +
            avatarBorder * 2 +
            chatVericalMargin * 2 +
            presenceIndicatorHeight
          }px);
          position: relative;
        }

        #chat-container #chat-history-container #chat-history {
          width: ${chatSidebarWidth - chatSidebarPadding * 2}px;
          position: absolute;
          left: 0;
          bottom: 0;
          max-height: 100%;
          overflow: auto;
        }

        #chat-container #chat-history-container #chat-history .chat-message {
          background-color: #222;
          color: #999;
          padding: ${chatMessageVerticalPadding}px ${chatMessageHorizontalPadding}px;
          margin-top: ${chatVericalMargin}px;
          border-radius: 2px;
          word-wrap: break-word;
          overflow: auto;
        }

        #chat-container #chat-history-container #chat-history .chat-message .chat-message-avatar {
          float: left;
          width: ${avatarSize + avatarPadding * 2 + avatarBorder * 2}px;
          height: ${avatarSize + avatarPadding * 2 + avatarBorder * 2}px;
          padding: ${avatarPadding}px;
          border: ${avatarBorder}px solid #444;
          border-radius: 2px;
        }

        #chat-container #chat-history-container #chat-history .chat-message .chat-message-avatar img {
          display: block;
          width: ${avatarSize}px;
          height: ${avatarSize}px;
        }

        #chat-container #chat-history-container #chat-history .chat-message .chat-message-body {
          padding-left: ${
            avatarSize +
            avatarPadding * 2 +
            avatarBorder * 2 +
            chatMessageHorizontalPadding
          }px;
        }

        #chat-container #chat-history-container #chat-history .chat-message.system-message .chat-message-body {
          font-style: italic;
          color: #666;
        }

        #chat-container #presence-indicator {
          position: absolute;
          left: ${chatSidebarPadding}px;
          bottom: ${
            chatSidebarPadding +
            chatMessageVerticalPadding * 2 +
            avatarSize +
            avatarPadding * 2 +
            avatarBorder * 2 +
            chatVericalMargin
          }px;
          width: ${chatSidebarWidth - chatSidebarPadding * 2}px;
          height: ${presenceIndicatorHeight}px;
          line-height: ${presenceIndicatorHeight}px;
          color: #666;
          font-style: italic;
        }

        #chat-container #chat-input-container {
          position: absolute;
          height: ${
            chatMessageVerticalPadding * 2 +
            avatarSize +
            avatarPadding * 2 +
            avatarBorder * 2
          }px;
          left: ${chatSidebarPadding}px;
          bottom: ${chatSidebarPadding}px;
          width: ${chatSidebarWidth - chatSidebarPadding * 2}px;
          background-color: #111;
          border: ${chatInputBorder}px solid #333;
          border-radius: 2px;
          overflow: auto;
          cursor: text;
        }

        #chat-container #chat-input-container #chat-input-avatar {
          float: left;
          width: ${avatarSize + avatarPadding * 2 + avatarBorder * 2}px;
          height: ${avatarSize + avatarPadding * 2 + avatarBorder * 2}px;
          padding: ${avatarPadding}px;
          border: ${avatarBorder}px solid #333;
          margin-left: ${chatMessageHorizontalPadding - chatInputBorder}px;
          margin-top: ${chatMessageVerticalPadding - chatInputBorder}px;
          margin-bottom: ${chatMessageVerticalPadding - chatInputBorder}px;
          border-radius: 2px;
        }

        #chat-container #chat-input-container #chat-input-avatar img {
          display: block;
          width: ${avatarSize}px;
          height: ${avatarSize}px;
        }

        #chat-container #chat-input-container #chat-input {
          display: block;
          height: ${
            avatarSize +
            avatarPadding * 2 +
            avatarBorder * 2 +
            chatMessageVerticalPadding * 2 -
            chatInputBorder * 2
          }px;
          line-height: ${avatarSize + avatarPadding * 2 + avatarBorder * 2}px;
          width: ${
            chatSidebarWidth -
            chatSidebarPadding * 2 -
            avatarSize -
            avatarPadding * 2 -
            avatarBorder * 2 -
            chatMessageHorizontalPadding -
            chatInputBorder
          }px;
          margin-left: ${
            avatarSize +
            avatarPadding * 2 +
            avatarBorder * 2 +
            chatMessageHorizontalPadding -
            chatInputBorder
          }px;
          background-color: #111;
          border: none;
          outline-style: none;
          color: #999;
          padding-top: ${chatMessageVerticalPadding - chatInputBorder}px;
          padding-right: ${chatMessageHorizontalPadding - chatInputBorder}px;
          padding-bottom: ${chatMessageVerticalPadding - chatInputBorder}px;
          padding-left: ${chatMessageHorizontalPadding}px;
        }
      </style>
      <div id="chat-container">
        <div id="chat-history-container">
          <div id="chat-history"></div>
        </div>
        <div id="presence-indicator">People are typing...</div>
        <div id="chat-input-container">
          <div id="chat-input-avatar"></div>
          <input id="chat-input"></input>
        </div>
      </div>
    `;

    // this is used for the chat presence feature
    var typingTimer = null;

    // set up the chat state, or reset the state if the system has already been set up
    var initChat = function () {
      console.log("initChat");
      if (document.querySelectorAll("#chat-container").length === 0) {
        jQuery('[class^="AudioVideoPlayerView-container"]').after(chatHtml);
        jQuery("#presence-indicator").hide();
        var oldPageX = null;
        var oldPageY = null;
        jQuery("#chat-container").mousedown(function (e) {
          oldPageX = e.pageX;
          oldPageY = e.pageY;
        });
        jQuery("#chat-container").mouseup(function (e) {
          if (
            (e.pageX - oldPageX) * (e.pageX - oldPageX) +
              (e.pageY - oldPageY) * (e.pageY - oldPageY) <
            5
          ) {
            jQuery("#chat-input").focus();
            e.stopPropagation();
          }
        });
        jQuery("#chat-input-container").click(function (e) {
          jQuery("#chat-input").focus();
        });
        jQuery("#chat-input").keydown(function (e) {
          e.stopPropagation();

          if (e.which === 13) {
            var body = jQuery("#chat-input")
              .val()
              .replace(/^\s+|\s+$/g, "");
            if (body !== "") {
              if (typingTimer !== null) {
                clearTimeout(typingTimer);
                typingTimer = null;
                socket.emit("typing", { typing: false }, function () {});
              }

              jQuery("#chat-input").prop("disabled", true);
              socket.emit(
                "sendMessage",
                {
                  body: body,
                },
                function () {
                  jQuery("#chat-input").val("").prop("disabled", false).focus();
                }
              );
            }
          } else {
            if (typingTimer === null) {
              socket.emit("typing", { typing: true }, function () {});
            } else {
              clearTimeout(typingTimer);
            }
            typingTimer = setTimeout(function () {
              typingTimer = null;
              socket.emit("typing", { typing: false }, function () {});
            }, 500);
          }
        });
        jQuery("#chat-input-avatar").html(
          `<img src="data:image/png;base64,${new Identicon(
            Sha256.hash(userId).substr(0, 32),
            avatarSize * 2,
            0
          ).toString()}" />`
        );

        // receive messages from the server
        socket.on("sendMessage", function (data) {
          addMessage(data);
        });

        // receive presence updates from the server
        socket.on("setPresence", function (data) {
          setPresenceVisible(data.anyoneTyping);
        });
      } else {
        jQuery("#chat-history").html("");
      }
    };

    // query whether the chat sidebar is visible
    var getChatVisible = function () {
      return document
        .querySelector('[class^="AudioVideoPlayerView-container"]')
        .classList.contains("with-chat");
    };

    // show or hide the chat sidebar
    var setChatVisible = function (visible) {
      if (visible) {
        jQuery('[class^="AudioVideoPlayerView-container"]').addClass(
          "with-chat"
        );
        jQuery("#chat-container").show();
        if (!document.hasFocus()) {
          clearUnreadCount();
        }
      } else {
        jQuery("#chat-container").hide();
        jQuery('[class^="AudioVideoPlayerView-container"]').removeClass(
          "with-chat"
        );
      }
    };

    // show or hide the "People are typing..." indicator
    var setPresenceVisible = function (visible) {
      if (visible) {
        jQuery("#presence-indicator").show();
      } else {
        jQuery("#presence-indicator").hide();
      }
    };

    // add a message to the chat history
    var addMessage = function (message) {
      messages.push(message);
      jQuery("#chat-history").append(`
        <div class="chat-message${
          message.isSystemMessage ? " system-message" : ""
        }">
          <div class="chat-message-avatar"><img src="data:image/png;base64,${new Identicon(
            Sha256.hash(message.userId).substr(0, 32),
            avatarSize * 2,
            0
          ).toString()}" /></div>
          <div class="chat-message-body">${message.body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</div>
        </div>
      `);
      jQuery("#chat-history").scrollTop(
        jQuery("#chat-history").prop("scrollHeight")
      );
      unreadCount += 1;
      if (!document.hasFocus()) {
        document.title = "(" + String(unreadCount) + ") " + originalTitle;
      }
    };

    // clear the unread count
    var clearUnreadCount = function () {
      if (unreadCount > 0) {
        unreadCount = 0;
        document.title = originalTitle;
      }
    };

    // clear the unread count when the window is focused
    jQuery(window).focus(function () {
      if (getChatVisible()) {
        clearUnreadCount();
      }
    });

    //////////////////////////////////////////////////////////////////////////
    // Main logic                                                           //
    //////////////////////////////////////////////////////////////////////////

    // the Netflix player be kept within this many milliseconds of our
    // internal representation for the playback time
    var maxTimeError = 2500;

    // the session
    var sessionId = null;
    var lastKnownTime = null;
    var lastKnownTimeUpdatedAt = null;
    var ownerId = null;
    var state = null;
    var videoKeyId = null;

    // ping the server periodically to estimate round trip time and client-server time offset
    var roundTripTimeRecent = [];
    var roundTripTimeMedian = 0;
    var localTimeMinusServerTimeRecent = [];
    var localTimeMinusServerTimeMedian = 0;

    var ping = function () {
      return new Promise(function (resolve, reject) {
        var startTime = new Date().getTime();
        socket.emit("getServerTime", { version: version }, function (
          serverTime
        ) {
          var now = new Date();

          // compute median round trip time
          shove(roundTripTimeRecent, now.getTime() - startTime, 5);
          roundTripTimeMedian = median(roundTripTimeRecent);

          // compute median client-server time offset
          shove(
            localTimeMinusServerTimeRecent,
            now.getTime() -
              Math.round(roundTripTimeMedian / 2) -
              new Date(serverTime).getTime(),
            5
          );
          localTimeMinusServerTimeMedian = median(
            localTimeMinusServerTimeRecent
          );

          resolve();
        });
      });
    };

    // this function should be called periodically to ensure the Plex
    // player matches our internal representation of the playback state
    var sync = function () {
      if (sessionId === null) {
        console.log("sessionId === null");
        return Promise.resolve();
      }
      if (state === "paused") {
        console.log("sync -> state === paused");
        var promise;
        if (getState() === "paused") {
          promise = Promise.resolve();
        } else {
          promise = pause();
        }
        return promise.then(function () {
          if (Math.abs(lastKnownTime - getPlaybackPosition()) > maxTimeError) {
            return seek(lastKnownTime)();
          }
        });
      } else {
        console.log("sync -> state !== paused");
        // First we ensure it's stopped loading
        return delayUntil(function () {
          return getState() !== "loading";
        }, Infinity)().then(function () {
          var localTime = getPlaybackPosition();

          var serverTime =
            lastKnownTime +
            (state === "playing"
              ? new Date().getTime() -
                (lastKnownTimeUpdatedAt.getTime() +
                  localTimeMinusServerTimeMedian)
              : 0);
          // localTime is video time
          // serverTime is ????
          console.log("sync() -> localTime", localTime);
          console.log("sync() -> serverTime", serverTime);
          console.log("sync() -> maxTimeError", maxTimeError);
          if (Math.abs(localTime - serverTime) > maxTimeError) {
            console.log(
              "sync -> Math.abs(localTime - serverTime) > maxTimeError"
            );
            return seek(serverTime + 2000)().then(function () {
              var localTime = getPlaybackPosition();
              var serverTime =
                lastKnownTime +
                (state === "playing"
                  ? new Date().getTime() -
                    (lastKnownTimeUpdatedAt.getTime() +
                      localTimeMinusServerTimeMedian)
                  : 0);

              if (
                localTime > serverTime &&
                localTime <= serverTime + maxTimeError
              ) {
                return freeze(localTime - serverTime)();
              } else {
                console.log(
                  "sync -> Math.abs(localTime - serverTime) > maxTimeError -> !(localTime > serverTime && localTime <= serverTime) + maxTimeError -> playa"
                );
                return play();
              }
            });
          } else {
            console.log(
              "sync -> Math.abs(localTime - serverTime) > maxTimeError -> play"
            );
            return play();
          }
        });
      }
    };

    // this is called when we need to send an update to the server
    // waitForChange is a boolean that indicates whether we should wait for
    // the Netflix player to update itself before we broadcast
    var broadcast = function (waitForChange) {
      return function () {
        var promise;
        if (waitForChange) {
          var oldPlaybackPosition = getPlaybackPosition();
          var oldState = getState();
          promise = swallow(
            delayUntil(function () {
              var newPlaybackPosition = getPlaybackPosition();
              var newState = getState();
              return (
                Math.abs(newPlaybackPosition - oldPlaybackPosition) >= 250 ||
                newState !== oldState
              );
            }, 2500)
          )();
        } else {
          promise = Promise.resolve();
        }

        return promise
          .then(
            delayUntil(function () {
              return getState() !== "loading";
            }, Infinity)
          )
          .then(function () {
            console.log("broadcast()");
            var now = new Date();
            var localTime = getPlaybackPosition();
            console.log("localTime/getPlaybackPosition()", localTime);
            console.log("now.getTime()", now.getTime());
            console.log(
              "lastKnownTimeUpdatedAt.getTime()",
              lastKnownTimeUpdatedAt.getTime()
            );
            console.log(
              "localTimeMinusServerTimeMedian",
              localTimeMinusServerTimeMedian
            );
            var serverTime =
              lastKnownTime +
              (state === "playing"
                ? now.getTime() -
                  (lastKnownTimeUpdatedAt.getTime() +
                    localTimeMinusServerTimeMedian)
                : 0);

            console.log("broadcast -> serverTime", serverTime);
            var newLastKnownTime = localTime;
            var newLastKnownTimeUpdatedAt = new Date(
              now.getTime() - localTimeMinusServerTimeMedian
            );
            var newState = getState() === "playing" ? "playing" : "paused";
            if (state === newState && Math.abs(localTime - serverTime) < 1) {
              return Promise.resolve();
            } else {
              var oldLastKnownTime = lastKnownTime;
              var oldLastKnownTimeUpdatedAt = lastKnownTimeUpdatedAt;
              var oldState = state;
              lastKnownTime = newLastKnownTime;
              lastKnownTimeUpdatedAt = newLastKnownTimeUpdatedAt;
              state = newState;
              return new Promise(function (resolve, reject) {
                socket.emit(
                  "updateSession",
                  {
                    lastKnownTime: newLastKnownTime,
                    lastKnownTimeUpdatedAt: newLastKnownTimeUpdatedAt.getTime(),
                    state: newState,
                  },
                  function (data) {
                    if (data !== undefined && data.errorMessage !== null) {
                      lastKnownTime = oldLastKnownTime;
                      lastKnownTimeUpdatedAt = oldLastKnownTimeUpdatedAt;
                      state = oldState;
                      reject();
                    } else {
                      resolve();
                    }
                  }
                );
              });
            }
          });
      };
    };

    // this is called when data is received from the server
    var receive = function (data) {
      console.log("received", data);
      lastKnownTime = data.lastKnownTime;
      lastKnownTimeUpdatedAt = new Date(data.lastKnownTimeUpdatedAt);
      state = data.state;
      return sync;
    };

    // the following allows us to linearize all tasks in the program to avoid interference
    var tasks = null;
    var tasksInFlight = 0;

    var pushTask = function (task) {
      if (tasksInFlight === 0) {
        // why reset tasks here? in case the native promises implementation isn't
        // smart enough to garbage collect old completed tasks in the chain.
        tasks = Promise.resolve();
      }
      tasksInFlight += 1;
      tasks = tasks
        .then(function () {
          if (getState() === "idle") {
            swallow(wakeUp)();
          }
        })
        .then(swallow(task))
        .then(function () {
          tasksInFlight -= 1;
        });
    };

    jQuery(window).mouseup(function () {
      if (sessionId !== null && uiEventsHappening === 0) {
        pushTask(function () {
          return broadcast(true)().catch(sync);
        });
      }
    });

    jQuery(window).keydown(function () {
      if (sessionId !== null && uiEventsHappening === 0) {
        pushTask(function () {
          return broadcast(true)().catch(sync);
        });
      }
    });

    socket.on("connect", function () {
      console.log("connect socket");
      pushTask(ping);
      setInterval(function () {
        if (tasksInFlight === 0) {
          var newVideoKeyId = getURLParameter(window.location.href, "key");
          if (videoKeyId !== null && videoKeyId !== newVideoKeyId) {
            videoKeyId = newVideoKeyId;
            sessionId = null;
            setChatVisible(false);
          }

          pushTask(ping);
          pushTask(sync);
        }
      }, 5000);
    });

    // if the server goes down, it can reconstruct the session with this
    socket.on("reconnect", function () {
      if (sessionId !== null) {
        socket.emit(
          "reboot",
          {
            sessionId: sessionId,
            lastKnownTime: lastKnownTime,
            lastKnownTimeUpdatedAt: lastKnownTimeUpdatedAt.getTime(),
            messages: messages,
            state: state,
            ownerId: ownerId,
            userId: userId,
            videoKeyId: videoKeyId,
          },
          function (data) {
            pushTask(receive(data));
          }
        );
      }
    });

    // respond to updates from the server
    socket.on("update", function (data) {
      pushTask(receive(data));
    });

    // interaction with the popup
    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponse
    ) {
      if (request.type === "getInitData") {
        console.log("getInitData from content_script");
        version = request.data.version;
        sendResponse({
          sessionId: sessionId,
          chatVisible: getChatVisible(),
        });
        return;
      }

      if (request.type === "createSession") {
        socket.emit(
          "createSession",
          {
            controlLock: request.data.controlLock,
            serverId: request.data.serverId,
            videoKeyId: request.data.videoKeyId,
          },
          function (data) {
            initChat();
            setChatVisible(true);
            lastKnownTime = data.lastKnownTime;
            lastKnownTimeUpdatedAt = new Date(data.lastKnownTimeUpdatedAt);
            messages = [];
            sessionId = data.sessionId;
            ownerId = request.data.controlLock ? userId : null;
            state = data.state;
            videoKeyId = request.data.videoKeyId;
            pushTask(broadcast(false));
            sendResponse({
              sessionId: sessionId,
            });
          }
        );
        return true;
      }

      if (request.type === "joinSession") {
        socket.emit("joinSession", request.data.sessionId, function (data) {
          if (data.errorMessage) {
            sendResponse({
              errorMessage: data.errorMessage,
            });
            return;
          }

          if (data.videoKeyId !== request.data.videoKeyId) {
            socket.emit("leaveSession", null, function (data) {
              sendResponse({
                errorMessage: "That session is for a different video.",
              });
            });
            return;
          }

          initChat();
          setChatVisible(true);
          sessionId = request.data.sessionId;
          lastKnownTime = data.lastKnownTime;
          lastKnownTimeUpdatedAt = new Date(data.lastKnownTimeUpdatedAt);
          messages = [];
          for (var i = 0; i < data.messages.length; i += 1) {
            addMessage(data.messages[i]);
          }
          ownerId = data.ownerId;
          state = data.state;
          videoKeyId = request.data.videoKeyId;
          pushTask(receive(data));
          sendResponse({});
        });
        return true;
      }

      if (request.type === "leaveSession") {
        socket.emit("leaveSession", null, function (_) {
          sessionId = null;
          setChatVisible(false);
          sendResponse({});
        });
        return true;
      }

      if (request.type === "showChat") {
        if (request.data.visible) {
          setChatVisible(true);
        } else {
          setChatVisible(false);
        }
        sendResponse({});
      }
    });
  }
})();
