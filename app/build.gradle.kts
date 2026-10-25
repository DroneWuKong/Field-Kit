plugins { id("com.android.application") }

android {
    namespace = "com.dronewukong.fieldtools"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.dronewukong.fieldtools.preview"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "0.3.3-preview.1"
    }
    sourceSets.getByName("main").assets.srcDir("../source/assets")
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes.getByName("release").isMinifyEnabled = false
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.github.mik3y:usb-serial-for-android:3.11.0")
}
