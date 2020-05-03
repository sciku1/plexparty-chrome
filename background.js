/* prettier-ignore */
"use strict";;

// only load for URLs that match app.plex.tv
chrome.runtime.onInstalled.addListener(function (details) {
  function onWebNav(details) {
    var refIndex = details.url.indexOf("#");
    var ref = refIndex >= 0 ? details.url.slice(refIndex + 1) : "";
    if (ref.indexOf("key") > -1) {
      // contains key? show page action
      chrome.pageAction.show(details.tabId);
    } else {
      chrome.pageAction.hide(details.tabId);
    }
  }
  // Base filter
  var filter = {
    url: [
      {
        hostEquals: "app.plex.tv",
      },
    ],
  };
  chrome.webNavigation.onCommitted.addListener(onWebNav, filter);
  chrome.webNavigation.onHistoryStateUpdated.addListener(onWebNav, filter);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(onWebNav, filter);
});
