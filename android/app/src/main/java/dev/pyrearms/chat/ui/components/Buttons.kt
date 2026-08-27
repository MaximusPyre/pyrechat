package dev.pyrearms.chat.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.theme.PyreColor
import dev.pyrearms.chat.ui.theme.PyreShape

@Composable
fun PyrePrimaryButton(
	text: String,
	onClick: () -> Unit,
	modifier: Modifier = Modifier,
	enabled: Boolean = true,
	loading: Boolean = false,
) {
	val interaction = remember { MutableInteractionSource() }
	val pressed by interaction.collectIsPressedAsState()
	val scale by animateFloatAsState(if (pressed && enabled) 0.97f else 1f, label = "btnScale")
	Box(
		modifier
			.scale(scale)
			.fillMaxWidth()
			.height(52.dp)
			.clip(PyreShape.md)
			.background(if (enabled) PyreColor.Ember else PyreColor.Row)
			.clickable(interactionSource = interaction, indication = null, enabled = enabled && !loading) { onClick() },
		contentAlignment = Alignment.Center,
	) {
		if (loading) {
			CircularProgressIndicator(Modifier.size(22.dp), color = PyreColor.Paper, strokeWidth = 2.dp)
		} else {
			Text(text, style = MaterialTheme.typography.labelLarge, color = PyreColor.Paper)
		}
	}
}

@Composable
fun PyreGhostButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
	Text(
		text,
		modifier = modifier
			.clip(PyreShape.pill)
			.clickable(onClick = onClick)
			.padding(horizontal = 12.dp, vertical = 8.dp),
		style = MaterialTheme.typography.labelLarge,
		color = PyreColor.EmberSoft,
	)
}

@Composable
fun PyreIconCircle(
	icon: ImageVector,
	contentDescription: String,
	onClick: () -> Unit,
	modifier: Modifier = Modifier,
	tint: Color = PyreColor.Paper,
	active: Boolean = false,
) {
	val bg = if (active) PyreColor.Ember.copy(alpha = 0.35f) else Color.Black.copy(alpha = 0.35f)
	Box(
		modifier
			.size(44.dp)
			.clip(CircleShape)
			.background(bg)
			.clickable(onClick = onClick),
		contentAlignment = Alignment.Center,
	) {
		Icon(icon, contentDescription, tint = tint, modifier = Modifier.size(22.dp))
	}
}

@Composable
fun PyreTextLink(text: String, onClick: () -> Unit) {
	Text(
		text,
		modifier = Modifier
			.clip(PyreShape.pill)
			.clickable(onClick = onClick)
			.padding(vertical = 6.dp),
		style = MaterialTheme.typography.bodyMedium,
		color = PyreColor.Mute,
	)
}
