package dev.pyrearms.chat

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.components.PyreBanner
import dev.pyrearms.chat.ui.components.PyreCard
import dev.pyrearms.chat.ui.components.PyreGhostButton
import dev.pyrearms.chat.ui.components.PyrePrimaryButton
import dev.pyrearms.chat.ui.components.PyreTextField
import dev.pyrearms.chat.ui.components.PyreBanner
import dev.pyrearms.chat.ui.components.PyreCard
import dev.pyrearms.chat.ui.theme.PyreColor
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun SnapchatOnboardSection(api: PyreClient, me: User, onScoreUpdated: (User) -> Unit) {
	val context = LocalContext.current
	var onboard by remember { mutableStateOf<JSONObject?>(null) }
	var snapUser by remember { mutableStateOf("") }
	var spotlight by remember { mutableStateOf("") }
	var error by remember { mutableStateOf<String?>(null) }
	var busy by remember { mutableStateOf(false) }
	var code by remember { mutableStateOf<String?>(null) }
	val scope = rememberCoroutineScope()

	val pickJson = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
		if (uri == null) return@rememberLauncherForActivityResult
		busy = true
		scope.launch {
			try {
				val text = context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText().orEmpty()
				val res = api.snapImport(text)
				val user = res.optJSONObject("user")
				if (user != null) onScoreUpdated(User.from(user))
				onboard = res.optJSONObject("onboard")
				code = null
				error = null
			} catch (e: Exception) {
				error = e.message
			} finally {
				busy = false
			}
		}
	}

	LaunchedEffect(Unit) {
		runCatching { api.snapOnboard() }
			.onSuccess {
				onboard = it
				snapUser = it.optString("snapchatUsername")
				if (it.optString("status") == "pending") code = it.optString("code").ifBlank { null }
			}
			.onFailure { error = it.message }
	}

	fun reload() {
		scope.launch {
			runCatching { onboard = api.snapOnboard() }
		}
	}

	PyreCard {
		Text("Snapchat verify", style = MaterialTheme.typography.titleLarge, color = PyreColor.Paper)
		Text(
			"Prove you own the account, then import your Snapscore 1:1.",
			style = MaterialTheme.typography.bodyMedium,
			color = PyreColor.Mute,
			modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
		)
		val status = onboard?.optString("status").orEmpty()
		when {
			status == "imported" -> {
				Text(
					"Imported ${onboard?.optInt("snapScoreClaimed") ?: me.snapScore} Pyre score from Snapchat.",
					style = MaterialTheme.typography.bodyMedium,
					color = PyreColor.Success,
				)
			}
			status == "verified" -> {
				Text(
					"Verified. Upload ranking.json from your Snapchat My Data export.",
					style = MaterialTheme.typography.bodyMedium,
					color = PyreColor.Mute,
					modifier = Modifier.padding(bottom = 12.dp),
				)
				PyrePrimaryButton(
					text = if (busy) "Importing…" else "Choose ranking.json",
					onClick = { pickJson.launch(arrayOf("application/json", "text/*")) },
					loading = busy,
					enabled = !busy,
				)
			}
			else -> {
				AnimatedContent(
					targetState = code != null,
					transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(160)) },
					label = "snapStep",
				) { hasCode ->
					Column {
						if (!hasCode) {
							PyreTextField(snapUser, { snapUser = it }, "Snapchat username")
							Spacer(Modifier.height(12.dp))
							PyrePrimaryButton(
								text = if (busy) "Starting…" else "Get verification code",
								onClick = {
									busy = true
									error = null
									scope.launch {
										try {
											val res = api.snapStart(snapUser.trim())
											onboard = res.getJSONObject("onboard")
											code = onboard?.optString("code")?.ifBlank { null }
										} catch (e: Exception) {
											error = e.message
										} finally {
											busy = false
										}
									}
								},
								loading = busy,
								enabled = !busy && snapUser.isNotBlank(),
							)
						} else {
							Text(
								"Post this code in a public Spotlight caption:",
								style = MaterialTheme.typography.bodyMedium,
								color = PyreColor.Mute,
							)
							Text(
								code!!,
								style = MaterialTheme.typography.headlineMedium,
								color = PyreColor.Ember,
								modifier = Modifier.padding(vertical = 8.dp),
							)
							PyreTextField(spotlight, { spotlight = it }, "Spotlight link")
							Spacer(Modifier.height(12.dp))
							PyrePrimaryButton(
								text = if (busy) "Checking…" else "Verify Spotlight",
								onClick = {
									busy = true
									error = null
									scope.launch {
										try {
											val res = api.snapVerify(spotlight.trim())
											onboard = res.getJSONObject("onboard")
											code = null
										} catch (e: Exception) {
											error = e.message
										} finally {
											busy = false
										}
									}
								},
								loading = busy,
								enabled = !busy && spotlight.isNotBlank(),
							)
							Spacer(Modifier.height(8.dp))
							PyreGhostButton("Start over", onClick = { code = null; reload() })
						}
					}
				}
			}
		}
		PyreBanner(error.orEmpty(), error != null, Modifier.padding(top = 8.dp))
	}
}
