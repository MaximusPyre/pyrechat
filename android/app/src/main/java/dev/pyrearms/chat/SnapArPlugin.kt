package dev.pyrearms.chat

import android.net.Uri
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.snap.camerakit.support.app.CameraActivity

@CapacitorPlugin(name = "SnapAr")
class SnapArPlugin : Plugin() {
	@PluginMethod
	fun available(call: PluginCall) {
		val token = BuildConfig.CAMERA_KIT_API_TOKEN
		val group = BuildConfig.CAMERA_KIT_LENS_GROUP_ID
		val ret = JSObject()
		ret.put("native", true)
		ret.put("configured", token.isNotBlank() && group.isNotBlank())
		call.resolve(ret)
	}

	@PluginMethod
	fun capture(call: PluginCall) {
		val token = BuildConfig.CAMERA_KIT_API_TOKEN
		val group = BuildConfig.CAMERA_KIT_LENS_GROUP_ID
		if (token.isBlank() || group.isBlank()) {
			call.reject(
				"Add Camera Kit credentials to android/camerakit.properties. Create an app at https://kit.snapchat.com/manage and enable Camera Kit at https://my-lenses.snapchat.com/camera-kit",
			)
			return
		}
		val act = MainActivity.instance
		if (act == null) {
			call.reject("Native camera is not ready")
			return
		}
		pending = call
		call.setKeepAlive(true)
		act.runOnUiThread {
			act.snapCapture.launch(
				CameraActivity.Configuration.WithLenses(
					lensGroupIds = arrayOf(group),
				),
			)
		}
	}

	companion object {
		@Volatile
		private var pending: PluginCall? = null

		fun onNativeResult(activity: MainActivity, result: CameraActivity.Capture.Result) {
			val call = pending
			pending = null
			if (call == null) return
			when (result) {
				is CameraActivity.Capture.Result.Success.Image -> resolveMedia(activity, call, result.uri, "photo")
				is CameraActivity.Capture.Result.Success.Video -> resolveMedia(activity, call, result.uri, "video")
				is CameraActivity.Capture.Result.Cancelled -> call.reject("cancelled", "CANCELLED")
				is CameraActivity.Capture.Result.Failure ->
					call.reject(result.exception.message ?: "Capture failed", "FAILED", result.exception)
			}
		}

		private fun resolveMedia(activity: MainActivity, call: PluginCall, uri: Uri, kind: String) {
			try {
				val file = copyCaptureToCache(activity, uri, kind)
				val mime = if (kind == "video") "video/mp4" else "image/jpeg"
				val b64 = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
				val ret = JSObject()
				ret.put("path", file.absolutePath)
				ret.put("kind", kind)
				ret.put("mime", mime)
				ret.put("base64", b64)
				call.resolve(ret)
			} catch (e: Exception) {
				call.reject(e.message ?: "Failed to save capture")
			}
		}
	}
}
