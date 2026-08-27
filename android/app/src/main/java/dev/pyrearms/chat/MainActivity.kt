package dev.pyrearms.chat

import android.net.Uri
import android.os.Bundle
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
		if (android.os.Build.VERSION.SDK_INT >= 26) {
			bridge.webView.importantForAutofill = android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
		}
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
