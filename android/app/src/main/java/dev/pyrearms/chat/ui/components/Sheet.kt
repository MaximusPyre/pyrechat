package dev.pyrearms.chat.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dev.pyrearms.chat.ui.theme.PyreColor

@Composable
fun PyreFullSheet(
	visible: Boolean,
	onDismiss: () -> Unit,
	content: @Composable ColumnScope.() -> Unit,
) {
	AnimatedVisibility(
		visible = visible,
		enter = slideInVertically(animationSpec = tween(280)) { it },
		exit = slideOutVertically(animationSpec = tween(220)) { it },
	) {
		Box(
			Modifier
				.fillMaxSize()
				.background(PyreColor.Ink)
				.statusBarsPadding(),
		) {
			Column(Modifier.fillMaxSize(), content = content)
		}
	}
}
