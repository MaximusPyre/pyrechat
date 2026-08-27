package dev.pyrearms.chat

import android.Manifest
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

@Composable
fun CaptureScreen(onCaptured: (File, String, String) -> Unit) {
	val context = LocalContext.current
	val lifecycle = LocalLifecycleOwner.current
	var granted by remember {
		mutableStateOf(
			ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
				ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED,
		)
	}
	val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
		granted = result[Manifest.permission.CAMERA] == true && result[Manifest.permission.RECORD_AUDIO] == true
	}
	LaunchedEffect(Unit) {
		if (!granted) ask.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
	}

	if (!granted) {
		Box(Modifier.fillMaxSize().background(Ink), contentAlignment = Alignment.Center) {
			Column(horizontalAlignment = Alignment.CenterHorizontally) {
				Text("PyreChat needs the camera", color = Paper, modifier = Modifier.padding(bottom = 12.dp))
				Button(onClick = { ask.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)) }, colors = ButtonDefaults.buttonColors(containerColor = Ember)) {
					Text("Allow camera")
				}
			}
		}
		return
	}

	val previewView = remember {
		PreviewView(context).apply {
			layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
			scaleType = PreviewView.ScaleType.FILL_CENTER
			implementationMode = PreviewView.ImplementationMode.PERFORMANCE
		}
	}
	var facing by remember { mutableStateOf(CameraSelector.LENS_FACING_FRONT) }
	var torch by remember { mutableStateOf(false) }
	var recording by remember { mutableStateOf(false) }
	var camera by remember { mutableStateOf<Camera?>(null) }
	var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
	var videoCapture by remember { mutableStateOf<VideoCapture<Recorder>?>(null) }
	var activeRec by remember { mutableStateOf<Recording?>(null) }
	val mainExecutor = remember { ContextCompat.getMainExecutor(context) }
	val handler = remember { Handler(Looper.getMainLooper()) }

	LaunchedEffect(facing) {
		val provider = context.cameraProvider()
		provider.unbindAll()
		val selector = CameraSelector.Builder().requireLensFacing(facing).build()
		val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
		val still = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build()
		val recorder = Recorder.Builder().setQualitySelector(
			QualitySelector.from(Quality.HD, androidx.camera.video.FallbackStrategy.lowerQualityOrHigherThan(Quality.HD)),
		).build()
		val video = VideoCapture.withOutput(recorder)
		camera = provider.bindToLifecycle(lifecycle, selector, preview, still, video)
		imageCapture = still
		videoCapture = video
		torch = false
	}
	DisposableEffect(Unit) {
		onDispose {
			activeRec?.stop()
			runCatching { ProcessCameraProvider.getInstance(context).get().unbindAll() }
		}
	}

	fun snap() {
		val cap = imageCapture ?: return
		val file = File(context.cacheDir, "pyre_${System.currentTimeMillis()}.jpg")
		cap.takePicture(
			ImageCapture.OutputFileOptions.Builder(file).build(),
			mainExecutor,
			object : ImageCapture.OnImageSavedCallback {
				override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
					onCaptured(file, "photo", "image/jpeg")
				}
				override fun onError(exception: ImageCaptureException) { /* keep preview */ }
			},
		)
	}

	fun startVideo() {
		val cap = videoCapture ?: return
		if (activeRec != null) return
		val file = File(context.cacheDir, "pyre_${System.currentTimeMillis()}.mp4")
		recording = true
		activeRec = cap.output
			.prepareRecording(context, FileOutputOptions.Builder(file).build())
			.withAudioEnabled()
			.start(mainExecutor) { event ->
				if (event is VideoRecordEvent.Finalize) {
					recording = false
					activeRec = null
					if (!event.hasError() && file.length() > 0) onCaptured(file, "video", "video/mp4")
				}
			}
	}

	fun stopVideo() {
		activeRec?.stop()
	}

	Box(Modifier.fillMaxSize().background(Color.Black)) {
		AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
		Row(
			Modifier
				.align(Alignment.TopEnd)
				.statusBarsPadding()
				.padding(12.dp),
		) {
			IconButton(onClick = {
				val next = !torch
				camera?.cameraControl?.enableTorch(next)
				torch = next && camera?.cameraInfo?.hasFlashUnit() == true
			}) {
				Icon(Icons.Filled.FlashOn, contentDescription = "Flash", tint = if (torch) Ember else Paper)
			}
			IconButton(onClick = {
				facing = if (facing == CameraSelector.LENS_FACING_FRONT) CameraSelector.LENS_FACING_BACK else CameraSelector.LENS_FACING_FRONT
			}) {
				Icon(Icons.Filled.Cameraswitch, contentDescription = "Flip", tint = Paper)
			}
		}
		Column(Modifier.align(Alignment.BottomCenter).padding(bottom = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
			Text(if (recording) "Recording" else "Tap photo · hold video", color = Paper, fontSize = 13.sp, modifier = Modifier.padding(bottom = 12.dp))
			Box(
				Modifier
					.size(78.dp)
					.clip(CircleShape)
					.background(if (recording) Ember else Paper)
					.pointerInput(imageCapture, videoCapture) {
						awaitEachGesture {
							awaitFirstDown()
							var started = false
							val start = Runnable {
								started = true
								startVideo()
							}
							handler.postDelayed(start, 220)
							waitForUpOrCancellation()
							handler.removeCallbacks(start)
							if (started) stopVideo() else snap()
						}
					},
			)
		}
	}
}

private suspend fun android.content.Context.cameraProvider(): ProcessCameraProvider =
	suspendCancellableCoroutine { cont ->
		val future = ProcessCameraProvider.getInstance(this)
		future.addListener(
			{
				try {
					cont.resume(future.get())
				} catch (e: Exception) {
					cont.resumeWithException(e)
				}
			},
			ContextCompat.getMainExecutor(this),
		)
	}
