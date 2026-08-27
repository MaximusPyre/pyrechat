package dev.pyrearms.chat.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val scheme = darkColorScheme(
	primary = PyreColor.Ember,
	onPrimary = PyreColor.Paper,
	secondary = PyreColor.EmberSoft,
	onSecondary = PyreColor.Ink,
	background = PyreColor.Ink,
	onBackground = PyreColor.Paper,
	surface = PyreColor.Panel,
	onSurface = PyreColor.Paper,
	surfaceVariant = PyreColor.Row,
	onSurfaceVariant = PyreColor.Mute,
	outline = PyreColor.Line,
	error = PyreColor.Error,
)

object PyreShape {
	val sm = RoundedCornerShape(12.dp)
	val md = RoundedCornerShape(16.dp)
	val lg = RoundedCornerShape(24.dp)
	val pill = RoundedCornerShape(50)
}

@Composable
fun PyreTheme(content: @Composable () -> Unit) {
	MaterialTheme(
		colorScheme = scheme,
		typography = PyreTypography,
		content = content,
	)
}
