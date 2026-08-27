package dev.pyrearms.chat.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.VisualTransformation
import dev.pyrearms.chat.ui.theme.PyreColor
import dev.pyrearms.chat.ui.theme.PyreShape

@Composable
fun PyreTextField(
	value: String,
	onValueChange: (String) -> Unit,
	label: String,
	modifier: Modifier = Modifier,
	singleLine: Boolean = true,
	visualTransformation: VisualTransformation = VisualTransformation.None,
	keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
	OutlinedTextField(
		value = value,
		onValueChange = onValueChange,
		label = { Text(label) },
		modifier = modifier.fillMaxWidth(),
		singleLine = singleLine,
		shape = PyreShape.md,
		visualTransformation = visualTransformation,
		keyboardOptions = keyboardOptions,
		textStyle = MaterialTheme.typography.bodyLarge.copy(color = PyreColor.Paper),
		colors = OutlinedTextFieldDefaults.colors(
			focusedBorderColor = PyreColor.Ember,
			unfocusedBorderColor = PyreColor.Line,
			focusedLabelColor = PyreColor.EmberSoft,
			unfocusedLabelColor = PyreColor.Mute,
			cursorColor = PyreColor.Ember,
			focusedContainerColor = PyreColor.Row.copy(alpha = 0.5f),
			unfocusedContainerColor = PyreColor.Row.copy(alpha = 0.35f),
		),
	)
}
