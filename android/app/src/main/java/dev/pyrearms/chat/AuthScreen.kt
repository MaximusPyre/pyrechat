package dev.pyrearms.chat

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.components.PyreBanner
import dev.pyrearms.chat.ui.components.PyreCard
import dev.pyrearms.chat.ui.components.PyreGhostButton
import dev.pyrearms.chat.ui.components.PyrePrimaryButton
import dev.pyrearms.chat.ui.components.PyreTextField
import dev.pyrearms.chat.ui.components.PyreTextLink
import dev.pyrearms.chat.ui.theme.PyreColor
import dev.pyrearms.chat.ui.theme.PyreShape
import kotlinx.coroutines.launch

private enum class AuthMode { Login, Signup, Recover }

@Composable
fun AuthScreen(api: PyreClient, onAuthed: (User, String?) -> Unit) {
	var mode by remember { mutableStateOf(AuthMode.Login) }
	var username by remember { mutableStateOf("") }
	var password by remember { mutableStateOf("") }
	var displayName by remember { mutableStateOf("") }
	var birthday by remember { mutableStateOf("") }
	var seed by remember { mutableStateOf("") }
	var error by remember { mutableStateOf<String?>(null) }
	var busy by remember { mutableStateOf(false) }
	val scope = rememberCoroutineScope()

	fun go() {
		error = null
		busy = true
		scope.launch {
			try {
				val (user, recovery) = when (mode) {
					AuthMode.Login -> api.login(username.trim(), password)
					AuthMode.Signup -> api.signup(username.trim(), password, displayName.trim().ifBlank { username.trim() }, birthday.trim())
					AuthMode.Recover -> api.recover(username.trim(), seed.trim(), password)
				}
				onAuthed(user, recovery)
			} catch (e: Exception) {
				error = e.message ?: "Could not sign in"
			} finally {
				busy = false
			}
		}
	}

	Column(
		Modifier
			.fillMaxSize()
			.background(
				Brush.verticalGradient(
					listOf(PyreColor.Ink, Color(0xFF1C120C), PyreColor.Ink),
				),
			)
			.imePadding()
			.verticalScroll(rememberScrollState())
			.padding(horizontal = 24.dp, vertical = 32.dp),
		horizontalAlignment = Alignment.CenterHorizontally,
		verticalArrangement = Arrangement.Center,
	) {
		BoxMark()
		Spacer(Modifier.height(24.dp))
		PyreCard {
			AnimatedContent(
				targetState = mode,
				transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(160)) },
				label = "authMode",
			) { current ->
				Column(Modifier.fillMaxWidth()) {
					Text(
						when (current) {
							AuthMode.Login -> "Welcome back"
							AuthMode.Signup -> "Create account"
							AuthMode.Recover -> "Recover account"
						},
						style = MaterialTheme.typography.titleLarge,
						color = PyreColor.Paper,
					)
					Text(
						when (current) {
							AuthMode.Login -> "Sign in to capture and send Pyres."
							AuthMode.Signup -> "Pick a username and birthday to join."
							AuthMode.Recover -> "Use your recovery key to reset access."
						},
						style = MaterialTheme.typography.bodyMedium,
						color = PyreColor.Mute,
						modifier = Modifier.padding(top = 6.dp, bottom = 20.dp),
					)
					PyreTextField(username, { username = it }, "Username")
					Spacer(Modifier.height(12.dp))
					if (current == AuthMode.Signup) {
						PyreTextField(displayName, { displayName = it }, "Display name")
						Spacer(Modifier.height(12.dp))
						PyreTextField(birthday, { birthday = it }, "Birthday (YYYY-MM-DD)")
						Spacer(Modifier.height(12.dp))
					}
					if (current == AuthMode.Recover) {
						PyreTextField(seed, { seed = it }, "Recovery key")
						Spacer(Modifier.height(12.dp))
					}
					PyreTextField(
						password,
						{ password = it },
						if (current == AuthMode.Recover) "New password" else "Password",
						visualTransformation = PasswordVisualTransformation(),
					)
				}
			}
		}
		PyreBanner(error.orEmpty(), error != null, Modifier.padding(top = 12.dp))
		Spacer(Modifier.height(16.dp))
		PyrePrimaryButton(
			text = when (mode) {
				AuthMode.Login -> "Log in"
				AuthMode.Signup -> "Create account"
				AuthMode.Recover -> "Recover"
			},
			onClick = { go() },
			loading = busy,
			enabled = !busy,
		)
		Spacer(Modifier.height(8.dp))
		if (mode != AuthMode.Recover) {
			PyreGhostButton(
				if (mode == AuthMode.Signup) "Have an account? Log in" else "Create account",
				onClick = { mode = if (mode == AuthMode.Login) AuthMode.Signup else AuthMode.Login },
			)
			PyreTextLink("Recover with key") { mode = AuthMode.Recover }
		} else {
			PyreTextLink("Back to log in") { mode = AuthMode.Login }
		}
	}
}

@Composable
private fun BoxMark() {
	Column(horizontalAlignment = Alignment.CenterHorizontally) {
		androidx.compose.foundation.layout.Box(
			Modifier
				.size(64.dp)
				.background(PyreColor.Ember.copy(alpha = 0.18f), PyreShape.lg)
				.padding(0.dp),
			contentAlignment = Alignment.Center,
		) {
			Text("🔥", style = MaterialTheme.typography.headlineLarge)
		}
		Spacer(Modifier.height(12.dp))
		Text("PyreChat", style = MaterialTheme.typography.displayLarge, color = PyreColor.Paper)
	}
}
