package dev.pyrearms.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
	val fieldColors = OutlinedTextFieldDefaults.colors(
		focusedBorderColor = Ember,
		unfocusedBorderColor = Mute.copy(alpha = 0.4f),
		focusedLabelColor = Ember,
		unfocusedLabelColor = Mute,
		cursorColor = Ember,
		focusedTextColor = Paper,
		unfocusedTextColor = Paper,
	)

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
			.background(Ink)
			.statusBarsPadding()
			.imePadding()
			.verticalScroll(rememberScrollState())
			.padding(24.dp),
		horizontalAlignment = Alignment.CenterHorizontally,
		verticalArrangement = Arrangement.Center,
	) {
		Text("PyreChat", color = Paper, fontSize = 28.sp, fontWeight = FontWeight.Black)
		Text("Camera messenger. Native capture.", color = Mute, modifier = Modifier.padding(top = 6.dp, bottom = 28.dp))
		OutlinedTextField(username, { username = it }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true)
		Spacer(Modifier.height(10.dp))
		if (mode == AuthMode.Signup) {
			OutlinedTextField(displayName, { displayName = it }, label = { Text("Display name") }, modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true)
			Spacer(Modifier.height(10.dp))
			OutlinedTextField(birthday, { birthday = it }, label = { Text("Birthday YYYY-MM-DD") }, modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true)
			Spacer(Modifier.height(10.dp))
		}
		if (mode == AuthMode.Recover) {
			OutlinedTextField(seed, { seed = it }, label = { Text("Recovery key") }, modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true)
			Spacer(Modifier.height(10.dp))
		}
		OutlinedTextField(
			password,
			{ password = it },
			label = { Text(if (mode == AuthMode.Recover) "New password" else "Password") },
			modifier = Modifier.fillMaxWidth(),
			colors = fieldColors,
			singleLine = true,
			visualTransformation = PasswordVisualTransformation(),
		)
		if (error != null) {
			Text(error!!, color = MaterialError, modifier = Modifier.padding(top = 12.dp))
		}
		Button(
			onClick = { go() },
			enabled = !busy,
			modifier = Modifier.fillMaxWidth().padding(top = 18.dp).height(48.dp),
			colors = ButtonDefaults.buttonColors(containerColor = Ember, contentColor = Paper),
			shape = RoundedCornerShape(14.dp),
		) {
			Text(
				when (mode) {
					AuthMode.Login -> if (busy) "…" else "Log in"
					AuthMode.Signup -> if (busy) "…" else "Create account"
					AuthMode.Recover -> if (busy) "…" else "Recover"
				},
				fontWeight = FontWeight.Bold,
			)
		}
		TextButton(onClick = { mode = if (mode == AuthMode.Login) AuthMode.Signup else AuthMode.Login }) {
			Text(if (mode == AuthMode.Signup) "Have an account? Log in" else "Create account", color = Ember2)
		}
		if (mode != AuthMode.Recover) {
			TextButton(onClick = { mode = AuthMode.Recover }) {
				Text("Recover with key", color = Mute)
			}
		}
	}
}

private val MaterialError = androidx.compose.ui.graphics.Color(0xFFFF8A70)
