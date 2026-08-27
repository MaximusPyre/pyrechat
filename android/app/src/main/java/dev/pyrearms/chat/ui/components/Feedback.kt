package dev.pyrearms.chat.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.theme.PyreColor

@Composable
fun PyreLoading(modifier: Modifier = Modifier) {
	Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
		CircularProgressIndicator(color = PyreColor.Ember, strokeWidth = 2.5.dp)
	}
}

@Composable
fun PyreEmpty(title: String, body: String, modifier: Modifier = Modifier) {
	Box(modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
		ColumnCentered(title, body)
	}
}

@Composable
private fun ColumnCentered(title: String, body: String) {
	androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
		Text(title, style = MaterialTheme.typography.titleLarge, color = PyreColor.Paper, textAlign = TextAlign.Center)
		Text(
			body,
			style = MaterialTheme.typography.bodyMedium,
			color = PyreColor.Mute,
			textAlign = TextAlign.Center,
			modifier = Modifier.padding(top = 8.dp),
		)
	}
}

@Composable
fun PyreBanner(message: String, visible: Boolean, modifier: Modifier = Modifier) {
	AnimatedVisibility(visible, modifier, fadeIn(), fadeOut()) {
		Text(
			message,
			style = MaterialTheme.typography.bodyMedium,
			color = PyreColor.Error,
			modifier = Modifier.padding(vertical = 8.dp),
		)
	}
}
