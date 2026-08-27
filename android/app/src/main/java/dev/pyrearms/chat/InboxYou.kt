package dev.pyrearms.chat

import android.graphics.BitmapFactory
import android.widget.VideoView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import java.io.File
import kotlinx.coroutines.launch

@Composable
fun InboxScreen(api: PyreClient, onOpen: (String) -> Unit) {
	var snaps by remember { mutableStateOf<List<InboxSnap>>(emptyList()) }
	var error by remember { mutableStateOf<String?>(null) }
	LaunchedEffect(Unit) {
		runCatching { api.inbox() }
			.onSuccess { snaps = it }
			.onFailure { error = it.message }
	}
	Column(Modifier.fillMaxSize().background(Ink).statusBarsPadding().padding(16.dp)) {
		Text("Inbox", color = Paper, fontSize = 24.sp, fontWeight = FontWeight.Black)
		if (error != null) Text(error!!, color = Ember, modifier = Modifier.padding(top = 12.dp))
		if (snaps.isEmpty() && error == null) {
			Text("No Pyres yet. Capture one.", color = Mute, modifier = Modifier.padding(top = 24.dp))
		}
		LazyColumn(Modifier.padding(top = 12.dp)) {
			items(snaps, key = { it.id }) { snap ->
				Row(
					Modifier
						.fillMaxWidth()
						.clickable { onOpen(snap.id) }
						.padding(vertical = 12.dp),
					horizontalArrangement = Arrangement.SpaceBetween,
					verticalAlignment = Alignment.CenterVertically,
				) {
					Column {
						Text(snap.displayName, color = Paper, fontWeight = FontWeight.Bold)
						Text(if (snap.viewed) "Opened" else "New ${snap.kind}", color = if (snap.viewed) Mute else Ember)
					}
					Text(snap.createdAt.take(10), color = Mute, fontSize = 12.sp)
				}
			}
		}
	}
}

@Composable
fun YouScreen(me: User, api: PyreClient, onLogout: () -> Unit) {
	val scope = rememberCoroutineScope()
	Column(Modifier.fillMaxSize().background(Ink).statusBarsPadding().padding(24.dp)) {
		Text(me.displayName, color = Paper, fontSize = 26.sp, fontWeight = FontWeight.Black)
		Text("@${me.username}", color = Mute)
		Text("Score ${me.snapScore}", color = Ember, modifier = Modifier.padding(top = 8.dp), fontWeight = FontWeight.Bold)
		Spacer(Modifier.height(28.dp))
		Text("This is the native Android app. Chat, stories, and tickets still live on chat.pyrearms.dev.", color = Mute)
		Button(
			onClick = {
				scope.launch {
					runCatching { api.logout() }
					onLogout()
				}
			},
			modifier = Modifier.padding(top = 24.dp),
			colors = ButtonDefaults.buttonColors(containerColor = Panel, contentColor = Paper),
		) {
			Text("Log out")
		}
	}
}

@Composable
fun RecoverySheet(key: String, onDone: () -> Unit) {
	Box(Modifier.fillMaxSize().background(Ink.copy(alpha = 0.96f)).statusBarsPadding().padding(24.dp), contentAlignment = Alignment.Center) {
		Column {
			Text("Recovery key", color = Paper, fontSize = 22.sp, fontWeight = FontWeight.Black)
			Text("Write this down. It is the only way back in.", color = Mute, modifier = Modifier.padding(vertical = 8.dp))
			Text(key, color = Ember2, fontWeight = FontWeight.Bold)
			Button(
				onClick = onDone,
				modifier = Modifier.padding(top = 20.dp),
				colors = ButtonDefaults.buttonColors(containerColor = Ember, contentColor = Paper),
			) { Text("I saved it") }
		}
	}
}

@Composable
fun SendSheet(api: PyreClient, file: File, kind: String, mime: String, onClose: () -> Unit) {
	var friends by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var picked by remember { mutableStateOf(setOf<String>()) }
	var caption by remember { mutableStateOf("") }
	var error by remember { mutableStateOf<String?>(null) }
	var busy by remember { mutableStateOf(false) }
	val scope = rememberCoroutineScope()
	LaunchedEffect(Unit) {
		runCatching { api.friends() }.onSuccess { friends = it }.onFailure { error = it.message }
	}
	Column(Modifier.fillMaxSize().background(Ink).statusBarsPadding().padding(16.dp)) {
		Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
			TextButton(onClick = onClose) { Text("Close", color = Mute) }
			Text("Send", color = Paper, fontWeight = FontWeight.Black)
			Button(
				onClick = {
					if (picked.isEmpty() || busy) return@Button
					busy = true
					scope.launch {
						try {
							val uploaded = api.upload(file.readBytes(), mime)
							api.sendSnap(uploaded.getString("key"), kind, picked.toList(), caption)
							onClose()
						} catch (e: Exception) {
							error = e.message
							busy = false
						}
					}
				},
				enabled = picked.isNotEmpty() && !busy,
				colors = ButtonDefaults.buttonColors(containerColor = Ember, contentColor = Paper),
			) { Text(if (busy) "…" else "Send") }
		}
		OutlinedTextField(
			caption,
			{ caption = it },
			label = { Text("Caption") },
			modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
			colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Ember, focusedLabelColor = Ember, cursorColor = Ember, focusedTextColor = Paper, unfocusedTextColor = Paper),
			singleLine = true,
		)
		if (error != null) Text(error!!, color = Ember)
		if (friends.isEmpty()) Text("Add friends on the web to send.", color = Mute, modifier = Modifier.padding(top = 12.dp))
		LazyColumn {
			items(friends, key = { it.id }) { f ->
				Row(
					Modifier.fillMaxWidth().clickable {
						picked = if (picked.contains(f.id)) picked - f.id else picked + f.id
					}.padding(vertical = 8.dp),
					verticalAlignment = Alignment.CenterVertically,
				) {
					Checkbox(
						checked = picked.contains(f.id),
						onCheckedChange = {
							picked = if (it) picked + f.id else picked - f.id
						},
						colors = CheckboxDefaults.colors(checkedColor = Ember),
					)
					Column {
						Text(f.displayName, color = Paper, fontWeight = FontWeight.Bold)
						Text("@${f.username}", color = Mute, fontSize = 12.sp)
					}
				}
			}
		}
	}
}

@Composable
fun SnapViewer(api: PyreClient, id: String, onClose: () -> Unit) {
	var kind by remember { mutableStateOf("photo") }
	var caption by remember { mutableStateOf("") }
	var bytes by remember { mutableStateOf<ByteArray?>(null) }
	var error by remember { mutableStateOf<String?>(null) }
	LaunchedEffect(id) {
		try {
			val snap = api.snap(id)
			kind = snap.optString("kind")
			caption = snap.optString("caption")
			bytes = api.mediaBytes(snap.optString("url"))
			api.markViewed(id)
		} catch (e: Exception) {
			error = e.message
		}
	}
	Box(Modifier.fillMaxSize().background(Ink).clickable { onClose() }) {
		when {
			error != null -> Text(error!!, color = Ember, modifier = Modifier.align(Alignment.Center).padding(24.dp))
			bytes == null -> CircularProgressIndicator(color = Ember, modifier = Modifier.align(Alignment.Center))
			kind == "video" -> {
				val tmp = remember(bytes) {
					File.createTempFile("pyre", ".mp4").apply { writeBytes(bytes!!) }
				}
				AndroidView(
					factory = { ctx ->
						VideoView(ctx).apply {
							setVideoPath(tmp.absolutePath)
							setOnPreparedListener { it.isLooping = true; start() }
						}
					},
					modifier = Modifier.fillMaxSize(),
				)
			}
			else -> {
				val bmp = remember(bytes) { BitmapFactory.decodeByteArray(bytes, 0, bytes!!.size) }
				if (bmp != null) Image(bmp.asImageBitmap(), contentDescription = null, modifier = Modifier.fillMaxSize())
			}
		}
		Column(Modifier.align(Alignment.TopStart).statusBarsPadding().padding(16.dp)) {
			TextButton(onClick = onClose) { Text("Close", color = Paper) }
			if (caption.isNotBlank()) Text(caption, color = Paper, fontWeight = FontWeight.Bold)
		}
	}
}
