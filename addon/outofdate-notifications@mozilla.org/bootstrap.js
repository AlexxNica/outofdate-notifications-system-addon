/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import('resource://gre/modules/TelemetryController.jsm');
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
                                  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyGetter(this, "gStringBundle", function() {
  return Services.strings.createBundle("chrome://outofdate-notifications/" +
                                       "locale/" +
                                       "outofdate-notifications.properties");
});

const PREF_UPDATE_URL         = "app.update.url.manual";
const PREF_UPDATE_DEFAULT_URL = "https://www.mozilla.org/firefox";

let gPingPayload = { shown: false, clicked: false };

function sendPing() {
  TelemetryController.submitExternalPing(
    "outofdate-notifications-system-addon", gPingPayload,
    { addClientId: true });
}

function startup() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
             .getService(Ci.nsIWindowMediator);

  // Load into any existing windows
  let browserWindow = wm.getMostRecentWindow("navigator:browser");
  loadIntoWindow(browserWindow);

  // Load into any new windows
  wm.addListener(windowListener);

  sendPing();
}

function showDoorhanger(aWindow) {
  if (!aWindow || !aWindow.gBrowser) {
    return;
  }
  let message = gStringBundle.GetStringFromName("message");
  let buttons = [
    {
      label:       gStringBundle.GetStringFromName("buttonlabel"),
      accessKey:   gStringBundle.GetStringFromName("buttonaccesskey"),
      callback: function () {
        gPingPayload.clicked = true;
        sendPing();

        let url = Preferences.get(PREF_UPDATE_URL, PREF_UPDATE_DEFAULT_URL);
        aWindow.openUILinkIn(url, "tab");
      }
    },
  ];
  let box =
    aWindow.document.getElementById("high-priority-global-notificationbox");
  if (!box) {
    return;
  }
  let notification = box.appendNotification(message, "outofdate-notifications",
                                         "", box.PRIORITY_WARNING_MEDIUM,
                                         buttons);
  let closeButton = aWindow.document.getAnonymousElementByAttribute(
    notification, "class", "messageCloseButton close-icon tabbable");
  closeButton.hidden = true;

  gPingPayload.shown = true;
  sendPing();
}

function loadIntoWindow(aWindow) {
  if (!aWindow) {
    return;
  }
  showDoorhanger(aWindow);
}

function unloadFromWindow(aWindow) {
  if (!aWindow) {
    return;
  }
  let box =
    aWindow.document.getElementById("high-priority-global-notificationbox");
  if (!box) {
    return;
  }
  let notification = box.getNotificationWithValue("outofdate-notifications");
  if (!notification) {
    return;
  }
  box.removeNotification(notification);
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },

  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {}
};

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN) {
    return;
  }

  // Stop listening for new windows
  Services.wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

function install() {}

function uninstall() {}
