package dev.pyrearms.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.components.PyreCard
import dev.pyrearms.chat.ui.components.PyrePrimaryButton
import dev.pyrearms.chat.ui.components.PyreScrollScreen
import dev.pyrearms.chat.ui.components.PyreScreenHeader
import dev.pyrearms.chat.ui.theme.PyreColor
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(me: User, api: PyreClient, onLogout: () -> Unit) {
	val scope = rememberCoroutineScope()
	var busy by remember { mutableStateOf(false) }
	var user by remember { mutableStateOf(me) }

	PyreScrollScreen {
		PyreScreenHeader("Profile", "@${user.username}")
		PyreCard {
			Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
				Column {
					Text("Pyre score", style = MaterialTheme.typography.labelMedium, color = PyreColor.Mute)
					Text(
						"${user.snapScore}",
						style = MaterialTheme.typography.displayLarge,
						color = PyreColor.Ember,
						modifier = Modifier.padding(top = 4.dp),
					)
				}
				Text("🔥", style = MaterialTheme.typography.headlineLarge)
			}
		}
		Spacer(Modifier.height(16.dp))
		SnapchatOnboardSection(api, user) { user = it }
		Spacer(Modifier.height(24.dp))
		PyrePrimaryButton(
			text = "Log out",
			onClick = {
				busy = true
				scope.launch {
					runCatching { api.logout() }
					onLogout()
				}
			},
			loading = busy,
			enabled = !busy,
		)
		Spacer(Modifier.height(32.dp))
	}
}
