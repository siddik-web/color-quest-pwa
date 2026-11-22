// Bundled into www/native.js for the Android app only. The website/PWA never loads this file.
import { Capacitor, SystemBars } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Share } from "@capacitor/share";
import { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents, AdmobConsentStatus } from "@capacitor-community/admob";

window.CQNative = { Capacitor, SystemBars, App, Share, AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents, AdmobConsentStatus };
