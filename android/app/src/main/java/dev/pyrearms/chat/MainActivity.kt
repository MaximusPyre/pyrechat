package dev.pyrearms.chat

import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebSettings
import com.getcapacitor.BridgeActivity
import com.snap.camerakit.support.app.CameraActivity
import java.io.File

class MainActivity : BridgeActivity() {
	val snapCapture = registerForActivityResult(CameraActivity.Capture) { result ->
		SnapArPlugin.onNativeResult(this, result)
	}

	override fun onCreate(savedInstanceState: Bundle?) {
		registerPlugin(SnapArPlugin::class.java)
		instance = this
		super.onCreate(savedInstanceState)
		hardenWebView()
	}

	override fun onStart() {
		super.onStart()
		hardenWebView()
	}

	private fun hardenWebView() {
		val webView = bridge?.webView ?: return
		if (Build.VERSION.SDK_INT >= 26) {
			webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
		}
		webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
		@Suppress("DEPRECATION")
		webView.settings.saveFormData = false
	}

	override fun onDestroy() {
		if (instance === this) instance = null
		super.onDestroy()
	}

	companion object {
		@JvmStatic
		var instance: MainActivity? = null
	}
}

fun copyCaptureToCache(activity: MainActivity, uri: Uri, kind: String): File {
	val ext = if (kind == "video") "mp4" else "jpg"
	val out = File(activity.cacheDir, "pyre_${System.currentTimeMillis()}.$ext")
	activity.contentResolver.openInputStream(uri)?.use { input ->
		out.outputStream().use { input.copyTo(it) }
	} ?: throw IllegalStateException("Could not read captured media")
	return out
}
