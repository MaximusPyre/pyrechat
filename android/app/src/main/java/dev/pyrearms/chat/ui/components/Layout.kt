package dev.pyrearms.chat.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import dev.pyrearms.chat.ui.theme.PyreColor
import dev.pyrearms.chat.ui.theme.PyreShape

@Composable
fun PyreScreen(
	modifier: Modifier = Modifier,
	content: @Composable ColumnScope.() -> Unit,
) {
	Column(
		modifier
			.fillMaxSize()
			.background(PyreColor.Ink)
			.windowInsetsPadding(WindowInsets.statusBars)
			.padding(horizontal = 20.dp),
		content = content,
	)
}

@Composable
fun PyreScrollScreen(
	modifier: Modifier = Modifier,
	bottomPadding: PaddingValues = PaddingValues(bottom = 24.dp),
	content: @Composable ColumnScope.() -> Unit,
) {
	Column(
		modifier
			.fillMaxSize()
			.background(PyreColor.Ink)
			.windowInsetsPadding(WindowInsets.statusBars)
			.verticalScroll(rememberScrollState())
			.padding(horizontal = 20.dp)
			.padding(bottomPadding),
		content = content,
	)
}

@Composable
fun PyreScreenHeader(title: String, subtitle: String? = null, action: @Composable (() -> Unit)? = null) {
	Row(
		Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 16.dp),
		horizontalArrangement = Arrangement.SpaceBetween,
		verticalAlignment = Alignment.CenterVertically,
	) {
		Column(Modifier.weight(1f)) {
			Text(title, style = MaterialTheme.typography.headlineLarge, color = PyreColor.Paper)
			if (subtitle != null) {
				Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = PyreColor.Mute, modifier = Modifier.padding(top = 4.dp))
			}
		}
		action?.invoke()
	}
}

@Composable
fun PyreTopBar(title: String, subtitle: String? = null) {
	PyreScreenHeader(title, subtitle)
}

data class PyreTabItem(val label: String, val icon: ImageVector)

@Composable
fun PyreBottomNav(
	items: List<PyreTabItem>,
	selected: Int,
	onSelect: (Int) -> Unit,
) {
	Row(
		Modifier
			.fillMaxWidth()
			.background(PyreColor.Panel.copy(alpha = 0.98f))
			.windowInsetsPadding(WindowInsets.navigationBars)
			.padding(horizontal = 16.dp, vertical = 10.dp),
		horizontalArrangement = Arrangement.SpaceEvenly,
		verticalAlignment = Alignment.CenterVertically,
	) {
		items.forEachIndexed { index, item ->
			val active = selected == index
			val tint by animateColorAsState(
				if (active) PyreColor.Ember else PyreColor.Mute,
				animationSpec = androidx.compose.animation.core.tween(200),
				label = "navTint",
			)
			val bg by animateColorAsState(
				if (active) PyreColor.Ember.copy(alpha = 0.14f) else Color.Transparent,
				animationSpec = androidx.compose.animation.core.tween(200),
				label = "navBg",
			)
			Column(
				Modifier
					.clip(PyreShape.pill)
					.background(bg)
					.clickable(
						interactionSource = remember { MutableInteractionSource() },
						indication = null,
						onClick = { onSelect(index) },
					)
					.padding(horizontal = 22.dp, vertical = 10.dp),
				horizontalAlignment = Alignment.CenterHorizontally,
			) {
				Icon(item.icon, contentDescription = item.label, tint = tint)
				Text(
					item.label,
					style = MaterialTheme.typography.labelSmall,
					color = tint,
					modifier = Modifier.padding(top = 4.dp),
				)
			}
		}
	}
}

@Composable
fun PyreCard(
	modifier: Modifier = Modifier,
	onClick: (() -> Unit)? = null,
	content: @Composable () -> Unit,
) {
	val interaction = remember { MutableInteractionSource() }
	val shape = PyreShape.md
	Box(
		modifier
			.fillMaxWidth()
			.clip(shape)
			.background(PyreColor.Row.copy(alpha = 0.65f))
			.then(
				if (onClick != null) {
					Modifier.clickable(interactionSource = interaction, indication = null, onClick = onClick)
				} else Modifier,
			)
			.padding(16.dp),
	) {
		content()
	}
}
