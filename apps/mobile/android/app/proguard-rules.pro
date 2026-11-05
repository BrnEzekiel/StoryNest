# React Native & TurboModules
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep public class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keep public class * implements com.facebook.react.bridge.NativeModule { *; }
-keep public class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class com.facebook.react.bridge.ReadableType { *; }

# Expo Modules & Lifecycle
-keep class expo.modules.** { *; }
-keep class expo.modules.core.** { *; }
-keep class expo.modules.updates.** { *; }
-keep class expo.modules.splashscreen.** { *; }
-keep class expo.modules.filesystem.** { *; }
-keep class expo.modules.securestore.** { *; }
-keep class expo.modules.notifications.** { *; }
-keep class expo.modules.av.** { *; }
-keep class expo.modules.sqlite.** { *; }

# AndroidX & Multidex
-keep class androidx.multidex.** { *; }
-keep class androidx.core.** { *; }
-keep class androidx.appcompat.** { *; }
-keep class androidx.fragment.app.** { *; }

# OkHttp & Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Paystack & Webview
-keep class com.reactnativecommunity.webview.** { *; }

# Lottie
-keep class com.airbnb.lottie.** { *; }
