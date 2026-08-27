package dev.pyrearms.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import java.io.File

enum class Tab { Inbox, Capture, You }

sealed class Overlay {
	data class Send(val file: File, val kind: String, val mime: String) : Overlay()
	data class Snap(val id: String) : Overlay()
	data class Recovery(val key: String) : Overlay()
}

@Composable
fun PyreRoot(api: PyreClient, session: SessionStore) {
	var booting by remember { mutableStateOf(true) }
	var user by remember { mutableStateOf(session.user()) }
	var tab by remember { mutableStateOf(Tab.Capture) }
	var overlay by remember { mutableStateOf<Overlay?>(null) }

	LaunchedEffect(session.token) {
		if (session.token == null) {
			user = null
			booting = false
			return@LaunchedEffect
		}
		user = runCatching { api.me() }.getOrElse {
			if (it is ApiException && it.status == 401) {
				session.clear()
				null
			} else session.user()
		}
		booting = false
	}

	when {
		booting -> {
			Box(Modifier.fillMaxSize().background(Ink), contentAlignment = Alignment.Center) {
				CircularProgressIndicator(color = Ember)
			}
		}
		user == null -> AuthScreen(api) { next, recovery ->
			user = next
			if (!recovery.isNullOrBlank()) overlay = Overlay.Recovery(recovery)
		}
		else -> {
			val me = user!!
			Box(Modifier.fillMaxSize().background(Ink)) {
				Column(Modifier.fillMaxSize()) {
					Box(Modifier.weight(1f).fillMaxWidth()) {
						when (tab) {
							Tab.Inbox -> InboxScreen(api, onOpen = { overlay = Overlay.Snap(it) })
							Tab.Capture -> CaptureScreen(
								onCaptured = { file, kind, mime -> overlay = Overlay.Send(file, kind, mime) },
							)
							Tab.You -> YouScreen(me, api) { user = null }
						}
					}
					NavigationBar(
						containerColor = Panel,
						modifier = Modifier.windowInsetsPadding(WindowInsets.navigationBars),
					) {
						val colors = NavigationBarItemDefaults.colors(
							selectedIconColor = Ember,
							selectedTextColor = Ember,
							unselectedIconColor = Mute,
							unselectedTextColor = Mute,
							indicatorColor = Color.Transparent,
						)
						NavigationBarItem(
							selected = tab == Tab.Inbox,
							onClick = { tab = Tab.Inbox },
							icon = { Icon(Icons.Filled.ChatBubble, contentDescription = "Inbox") },
							label = { Text("Inbox") },
							colors = colors,
						)
						NavigationBarItem(
							selected = tab == Tab.Capture,
							onClick = { tab = Tab.Capture },
							icon = { Icon(Icons.Filled.PhotoCamera, contentDescription = "Capture") },
							label = { Text("Capture") },
							colors = colors,
						)
						NavigationBarItem(
							selected = tab == Tab.You,
							onClick = { tab = Tab.You },
							icon = { Icon(Icons.Filled.Person, contentDescription = "You") },
							label = { Text("You") },
							colors = colors,
						)
					}
				}
				when (val sheet = overlay) {
					is Overlay.Send -> SendSheet(
						api = api,
						file = sheet.file,
						kind = sheet.kind,
						mime = sheet.mime,
						onClose = { overlay = null },
					)
					is Overlay.Snap -> SnapViewer(
						api = api,
						id = sheet.id,
						onClose = { overlay = null },
					)
					is Overlay.Recovery -> RecoverySheet(sheet.key) { overlay = null }
					null -> Unit
				}
			}
		}
	}
}
