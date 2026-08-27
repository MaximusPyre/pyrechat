package dev.pyrearms.chat

import android.graphics.BitmapFactory
import android.widget.VideoView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.layout.statusBarsPadding
import dev.pyrearms.chat.ui.components.PyreBanner
import dev.pyrearms.chat.ui.components.PyreCard
import dev.pyrearms.chat.ui.components.PyreEmpty
import dev.pyrearms.chat.ui.components.PyreGhostButton
import dev.pyrearms.chat.ui.components.PyreLoading
import dev.pyrearms.chat.ui.components.PyrePrimaryButton
import dev.pyrearms.chat.ui.components.PyreScreen
import dev.pyrearms.chat.ui.components.PyreTextField
import dev.pyrearms.chat.ui.components.PyreTopBar
import dev.pyrearms.chat.ui.theme.PyreColor
import java.io.File
import kotlinx.coroutines.launch

@Composable
fun RecoverySheet(key: String, onDone: () -> Unit) {
	Box(Modifier.fillMaxSize().background(PyreColor.Ink.copy(alpha = 0.98f)).padding(24.dp), contentAlignment = Alignment.Center) {
		Column(horizontalAlignment = Alignment.CenterHorizontally) {
			Text("Recovery key", style = MaterialTheme.typography.headlineMedium, color = PyreColor.Paper)
			Text(
				"Write this down. It is the only way back in.",
				style = MaterialTheme.typography.bodyMedium,
				color = PyreColor.Mute,
				modifier = Modifier.padding(vertical = 12.dp),
			)
			Text(key, style = MaterialTheme.typography.bodyLarge, color = PyreColor.EmberSoft)
			Spacer(Modifier.height(24.dp))
			PyrePrimaryButton("I saved it", onDone)
		}
	}
}

@Composable
fun SendSheet(api: PyreClient, file: File, kind: String, mime: String, onClose: () -> Unit) {
	var friends by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var suggestions by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var searchHits by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var searchQ by remember { mutableStateOf("") }
	var picked by remember { mutableStateOf(setOf<String>()) }
	var caption by remember { mutableStateOf("") }
	var error by remember { mutableStateOf<String?>(null) }
	var busy by remember { mutableStateOf(false) }
	var loading by remember { mutableStateOf(true) }
	var sent by remember { mutableStateOf(false) }
	val scope = rememberCoroutineScope()

	LaunchedEffect(Unit) {
		loading = true
		runCatching {
			friends = api.friends()
			suggestions = api.quickAdd()
		}.onFailure { error = it.message }
		loading = false
	}

	LaunchedEffect(searchQ) {
		if (searchQ.length < 2) {
			searchHits = emptyList()
			return@LaunchedEffect
		}
		runCatching { searchHits = api.searchUsers(searchQ.trim()) }
			.onFailure { error = it.message }
	}

	val list = when {
		searchQ.length >= 2 -> searchHits
		friends.isNotEmpty() -> friends
		else -> suggestions
	}

	Box(
		Modifier
			.fillMaxSize()
			.background(PyreColor.Ink)
			.statusBarsPadding(),
	) {
		when {
			sent -> Column(
				Modifier.fillMaxSize().padding(32.dp),
				horizontalAlignment = Alignment.CenterHorizontally,
				verticalArrangement = Arrangement.Center,
			) {
				Text("Sent!", style = MaterialTheme.typography.headlineLarge, color = PyreColor.Ember)
				Text("Your Pyre is on its way.", style = MaterialTheme.typography.bodyMedium, color = PyreColor.Mute, modifier = Modifier.padding(top = 8.dp))
			}
			else -> Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
				Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
					PyreGhostButton("Close", onClose)
					Text("Send Pyre", style = MaterialTheme.typography.titleLarge, color = PyreColor.Paper)
					PyreGhostButton(
						if (busy) "…" else "Send",
						onClick = {
							if (picked.isEmpty() || busy) return@PyreGhostButton
							busy = true
							error = null
							scope.launch {
								try {
									val uploaded = api.upload(file.readBytes(), mime)
									api.sendSnap(uploaded.getString("key"), kind, picked.toList(), caption)
									sent = true
									kotlinx.coroutines.delay(900)
									onClose()
								} catch (e: Exception) {
									error = e.message
									busy = false
								}
							}
						},
					)
				}
				Spacer(Modifier.height(12.dp))
				PyreTextField(caption, { caption = it }, "Caption")
				PyreTextField(searchQ, { searchQ = it }, "Search or add friends")
				PyreBanner(error.orEmpty(), error != null)
				if (searchQ.length >= 2 && searchHits.size == 1) {
					PyreGhostButton("Add @${searchHits.first().username}", onClick = {
						scope.launch {
							runCatching {
								api.addFriend(searchHits.first().username)
								friends = api.friends()
								searchQ = ""
							}.onFailure { error = it.message }
						}
					})
				}
				when {
					loading -> PyreLoading(Modifier.weight(1f))
					list.isEmpty() -> PyreEmpty(
						"No friends yet",
						"Search a username above or add friends on chat.pyrearms.dev.",
						Modifier.weight(1f),
					)
					else -> LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
						if (friends.isEmpty() && searchQ.length < 2 && suggestions.isNotEmpty()) {
							item {
								Text("Suggested", style = MaterialTheme.typography.labelMedium, color = PyreColor.Mute, modifier = Modifier.padding(bottom = 4.dp))
							}
						}
						items(list, key = { it.id }) { f ->
							val selected = picked.contains(f.id)
							val isFriend = friends.any { it.id == f.id }
							PyreCard(onClick = {
								if (isFriend) {
									picked = if (selected) picked - f.id else picked + f.id
								}
							}) {
								Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
									Row(verticalAlignment = Alignment.CenterVertically) {
										if (isFriend || picked.contains(f.id)) {
											Text(
												if (selected) "✓" else "○",
												color = if (selected) PyreColor.Ember else PyreColor.Mute,
												modifier = Modifier.padding(end = 12.dp),
											)
										}
										Column {
											Text(f.displayName, style = MaterialTheme.typography.titleMedium, color = PyreColor.Paper)
											Text("@${f.username}", style = MaterialTheme.typography.labelMedium, color = PyreColor.Mute)
										}
									}
									if (!isFriend) {
										PyreGhostButton("Add", onClick = {
											scope.launch {
												runCatching {
													api.addFriend(f.username)
													friends = api.friends()
													picked = picked + f.id
												}.onFailure { error = it.message }
											}
										})
									}
								}
							}
						}
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
	Box(Modifier.fillMaxSize().background(PyreColor.Ink).clickable { onClose() }) {
		when {
			error != null -> Text(error!!, color = PyreColor.Error, modifier = Modifier.align(Alignment.Center).padding(24.dp))
			bytes == null -> CircularProgressIndicator(color = PyreColor.Ember, modifier = Modifier.align(Alignment.Center))
			kind == "video" -> {
				val tmp = remember(bytes) { File.createTempFile("pyre", ".mp4").apply { writeBytes(bytes!!) } }
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
		AnimatedVisibility(visible = true, enter = fadeIn(tween(200)), modifier = Modifier.align(Alignment.TopStart).padding(16.dp)) {
			PyreGhostButton("Close", onClose)
			if (caption.isNotBlank()) {
				Text(caption, style = MaterialTheme.typography.titleMedium, color = PyreColor.Paper, modifier = Modifier.padding(top = 8.dp))
			}
		}
	}
}
