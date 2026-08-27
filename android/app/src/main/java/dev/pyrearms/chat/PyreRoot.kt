package dev.pyrearms.chat

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import dev.pyrearms.chat.ui.components.PyreBottomNav
import dev.pyrearms.chat.ui.components.PyreLoading
import dev.pyrearms.chat.ui.components.PyreTabItem
import dev.pyrearms.chat.ui.theme.PyreColor
import java.io.File

enum class Tab { Chat, Capture, Profile }

sealed class Overlay {
	data class Send(val file: File, val kind: String, val mime: String) : Overlay()
	data class Snap(val id: String) : Overlay()
	data class Recovery(val key: String) : Overlay()
	data class Thread(val chat: ChatRow) : Overlay()
	data object AddFriends : Overlay()
}

private val tabs = listOf(
	PyreTabItem("Chat", Icons.Outlined.ChatBubbleOutline),
	PyreTabItem("Capture", Icons.Outlined.PhotoCamera),
	PyreTabItem("Profile", Icons.Outlined.PersonOutline),
)

@Composable
fun PyreRoot(api: PyreClient, session: SessionStore) {
	var booting by remember { mutableStateOf(true) }
	var user by remember { mutableStateOf(session.user()) }
	var tab by remember { mutableStateOf(Tab.Capture) }
	var overlay by remember { mutableStateOf<Overlay?>(null) }
	var chatRefresh by remember { mutableIntStateOf(0) }

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
		booting -> PyreLoading(Modifier.fillMaxSize().background(PyreColor.Ink))
		user == null -> AuthScreen(api) { next, recovery ->
			user = next
			if (!recovery.isNullOrBlank()) overlay = Overlay.Recovery(recovery)
		}
		else -> {
			val me = user!!
			Box(Modifier.fillMaxSize().background(PyreColor.Ink)) {
				Column(Modifier.fillMaxSize()) {
					AnimatedContent(
						targetState = tab,
						modifier = Modifier.weight(1f).fillMaxWidth(),
						transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(160)) },
						label = "tab",
					) { current ->
						when (current) {
							Tab.Chat -> ChatScreen(
								api = api,
								meId = me.id,
								refreshKey = chatRefresh,
								onOpenChat = { overlay = Overlay.Thread(it) },
								onAddFriends = { overlay = Overlay.AddFriends },
							)
							Tab.Capture -> CaptureScreen(
								onCaptured = { file, kind, mime -> overlay = Overlay.Send(file, kind, mime) },
							)
							Tab.Profile -> ProfileScreen(me, api) { user = null }
						}
					}
					PyreBottomNav(
						items = tabs,
						selected = tab.ordinal,
						onSelect = { tab = Tab.entries[it] },
					)
				}
				when (val sheet = overlay) {
					is Overlay.Send -> SendSheet(
						api = api,
						file = sheet.file,
						kind = sheet.kind,
						mime = sheet.mime,
						onClose = {
							overlay = null
							chatRefresh++
						},
					)
					is Overlay.Snap -> SnapViewer(api = api, id = sheet.id, onClose = { overlay = null })
					is Overlay.Recovery -> RecoverySheet(sheet.key) { overlay = null }
					is Overlay.Thread -> ChatThreadScreen(
						api = api,
						meId = me.id,
						chat = sheet.chat,
						onClose = {
							overlay = null
							chatRefresh++
						},
					)
					Overlay.AddFriends -> AddFriendsScreen(api) {
						overlay = null
						chatRefresh++
					}
					null -> Unit
				}
			}
		}
	}
}
