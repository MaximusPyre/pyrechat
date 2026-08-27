package dev.pyrearms.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.components.PyreBanner
import dev.pyrearms.chat.ui.components.PyreCard
import dev.pyrearms.chat.ui.components.PyreEmpty
import dev.pyrearms.chat.ui.components.PyreGhostButton
import dev.pyrearms.chat.ui.components.PyreLoading
import dev.pyrearms.chat.ui.components.PyreScreen
import dev.pyrearms.chat.ui.components.PyreScreenHeader
import dev.pyrearms.chat.ui.components.PyreTextField
import dev.pyrearms.chat.ui.theme.PyreColor
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray

@Composable
fun ChatScreen(
	api: PyreClient,
	meId: String,
	refreshKey: Int,
	onOpenChat: (ChatRow) -> Unit,
	onAddFriends: () -> Unit,
) {
	var chats by remember { mutableStateOf<List<ChatRow>>(emptyList()) }
	var loading by remember { mutableStateOf(true) }
	var error by remember { mutableStateOf<String?>(null) }
	var q by remember { mutableStateOf("") }

	LaunchedEffect(refreshKey) {
		loading = true
		runCatching { chats = api.chats() }
			.onFailure { error = it.message }
		loading = false
	}

	val shown = if (q.isBlank()) chats else {
		val needle = q.trim().lowercase()
		chats.filter { c ->
			c.title.lowercase().contains(needle) || c.members.any { it.username.lowercase().contains(needle) }
		}
	}

	PyreScreen {
		PyreScreenHeader("Chat", "Messages with friends", action = {
			IconButton(onClick = onAddFriends) {
				Icon(Icons.Outlined.PersonAdd, "Add friends", tint = PyreColor.Ember)
			}
		})
		PyreTextField(q, { q = it }, "Search")
		Spacer(Modifier.height(12.dp))
		PyreBanner(error.orEmpty(), error != null)
		when {
			loading -> PyreLoading(Modifier.weight(1f))
			shown.isEmpty() -> PyreEmpty(
				"No chats yet",
				"Add friends to start messaging.",
				Modifier.weight(1f),
			)
			else -> LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
				items(shown, key = { it.id }) { chat ->
					PyreCard(onClick = { onOpenChat(chat) }) {
						Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
							Column(Modifier.weight(1f)) {
								Row(verticalAlignment = Alignment.CenterVertically) {
									Text(chat.title, style = MaterialTheme.typography.titleMedium, color = PyreColor.Paper)
									if (chat.streak > 0) {
										Text(" 🔥${chat.streak}", style = MaterialTheme.typography.labelMedium, color = PyreColor.Ember)
									}
								}
								Text(
									chat.subtitle,
									style = MaterialTheme.typography.bodyMedium,
									color = if (chat.unopenedSnaps > 0) PyreColor.Ember else PyreColor.Mute,
									maxLines = 1,
								)
							}
							if (chat.unopenedSnaps > 0) {
								Box(
									Modifier
										.clip(RoundedCornerShape(50))
										.background(PyreColor.Ember)
										.padding(horizontal = 8.dp, vertical = 4.dp),
								) {
									Text("${chat.unopenedSnaps}", style = MaterialTheme.typography.labelSmall, color = PyreColor.Paper)
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
fun ChatThreadScreen(api: PyreClient, meId: String, chat: ChatRow, onClose: () -> Unit) {
	var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
	var draft by remember { mutableStateOf("") }
	var error by remember { mutableStateOf<String?>(null) }
	var busy by remember { mutableStateOf(false) }
	var tick by remember { mutableIntStateOf(0) }
	val scope = rememberCoroutineScope()
	val listState = rememberLazyListState()

	LaunchedEffect(chat.id, tick) {
		runCatching { messages = api.messages(chat.id) }
			.onFailure { error = it.message }
		if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
	}

	LaunchedEffect(chat.id) {
		while (true) {
			delay(4000)
			tick++
		}
	}

	Column(
		Modifier
			.fillMaxSize()
			.background(PyreColor.Ink)
			.statusBarsPadding()
			.imePadding(),
	) {
		Row(
			Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
			verticalAlignment = Alignment.CenterVertically,
		) {
			PyreGhostButton("Back", onClose)
			Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
				Text(chat.title, style = MaterialTheme.typography.titleLarge, color = PyreColor.Paper)
				if (chat.streak > 0) {
					Text("🔥 ${chat.streak} day streak", style = MaterialTheme.typography.labelMedium, color = PyreColor.Ember)
				}
			}
		}
		PyreBanner(error.orEmpty(), error != null, Modifier.padding(horizontal = 20.dp))
		LazyColumn(
			Modifier.weight(1f).padding(horizontal = 16.dp),
			state = listState,
			verticalArrangement = Arrangement.spacedBy(8.dp),
		) {
			items(messages, key = { it.id }) { msg ->
				val mine = msg.senderId == meId
				Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
					Column(
						Modifier
							.widthIn(max = 280.dp)
							.clip(RoundedCornerShape(16.dp))
							.background(if (mine) PyreColor.Ember.copy(alpha = 0.85f) else PyreColor.Row)
							.padding(horizontal = 14.dp, vertical = 10.dp),
					) {
						if (!mine) {
							Text(msg.displayName, style = MaterialTheme.typography.labelSmall, color = PyreColor.Mute)
						}
						Text(
							if (msg.kind == "text") msg.body else msg.kind,
							style = MaterialTheme.typography.bodyMedium,
							color = PyreColor.Paper,
						)
					}
				}
			}
		}
		Row(
			Modifier
				.fillMaxWidth()
				.navigationBarsPadding()
				.padding(horizontal = 16.dp, vertical = 12.dp),
			verticalAlignment = Alignment.CenterVertically,
		) {
			PyreTextField(draft, { draft = it }, "Message", modifier = Modifier.weight(1f))
			Spacer(Modifier.width(8.dp))
			PyreGhostButton(if (busy) "…" else "Send", onClick = {
				val text = draft.trim()
				if (text.isBlank() || busy) return@PyreGhostButton
				busy = true
				scope.launch {
					try {
						api.sendMessage(chat.id, text)
						draft = ""
						tick++
					} catch (e: Exception) {
						error = e.message
					} finally {
						busy = false
					}
				}
			})
		}
	}
}

@Composable
fun AddFriendsScreen(api: PyreClient, onClose: () -> Unit) {
	var q by remember { mutableStateOf("") }
	var searchHits by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var suggestions by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var incoming by remember { mutableStateOf<List<Friend>>(emptyList()) }
	var error by remember { mutableStateOf<String?>(null) }
	var loading by remember { mutableStateOf(true) }
	val scope = rememberCoroutineScope()

	fun reload() {
		scope.launch {
			loading = true
			runCatching {
				val adds = api.friendAdds()
				suggestions = jsonArr(adds.optJSONArray("suggestions")).map { Friend.from(it) }
				incoming = jsonArr(adds.optJSONArray("incoming")).map { Friend.from(it) }
			}.onFailure { error = it.message }
			loading = false
		}
	}

	LaunchedEffect(Unit) { reload() }

	LaunchedEffect(q) {
		if (q.length < 2) {
			searchHits = emptyList()
			return@LaunchedEffect
		}
		runCatching { searchHits = api.searchUsers(q.trim()) }
			.onFailure { error = it.message }
	}

	Column(
		Modifier
			.fillMaxSize()
			.background(PyreColor.Ink)
			.statusBarsPadding()
			.padding(horizontal = 20.dp),
	) {
		Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
			PyreGhostButton("Close", onClose)
			Text("Add friends", style = MaterialTheme.typography.titleLarge, color = PyreColor.Paper)
			Spacer(Modifier.widthIn(48.dp))
		}
		Spacer(Modifier.height(12.dp))
		PyreTextField(q, { q = it }, "Search username")
		PyreBanner(error.orEmpty(), error != null)
		when {
			loading -> PyreLoading(Modifier.weight(1f))
			else -> LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
				val list = if (q.length >= 2) searchHits else suggestions
				if (incoming.isNotEmpty()) {
					item { Text("Requests", style = MaterialTheme.typography.labelMedium, color = PyreColor.Mute) }
					items(incoming, key = { "in-${it.id}" }) { f ->
						FriendRow(f, "Accept") {
							scope.launch {
								runCatching {
									api.addFriend(f.username)
									reload()
								}.onFailure { error = it.message }
							}
						}
					}
				}
				if (list.isNotEmpty()) {
					item {
						Text(
							if (q.length >= 2) "Results" else "Suggested",
							style = MaterialTheme.typography.labelMedium,
							color = PyreColor.Mute,
							modifier = Modifier.padding(top = 8.dp),
						)
					}
					items(list, key = { it.id }) { f ->
						FriendRow(f, "Add") {
							scope.launch {
								runCatching {
									api.addFriend(f.username)
									reload()
								}.onFailure { error = it.message }
							}
						}
					}
				}
				if (incoming.isEmpty() && list.isEmpty()) {
					item { PyreEmpty("No one here", "Try searching for a username.", Modifier.fillMaxWidth()) }
				}
			}
		}
	}
}

@Composable
private fun FriendRow(f: Friend, action: String, onAction: () -> Unit) {
	PyreCard {
		Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
			Column {
				Text(f.displayName, style = MaterialTheme.typography.titleMedium, color = PyreColor.Paper)
				Text("@${f.username}", style = MaterialTheme.typography.labelMedium, color = PyreColor.Mute)
			}
			PyreGhostButton(action, onAction)
		}
	}
}

private fun jsonArr(arr: JSONArray?): List<org.json.JSONObject> {
	if (arr == null) return emptyList()
	return (0 until arr.length()).map { arr.getJSONObject(it) }
}
