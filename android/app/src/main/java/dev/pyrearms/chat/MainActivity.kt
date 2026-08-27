package dev.pyrearms.chat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

val Ember = Color(0xFFFC7A1A)
val Ember2 = Color(0xFFFFB056)
val Ink = Color(0xFF140E0B)
val Panel = Color(0xFF1F1612)
val Paper = Color(0xFFFBF6F0)
val Mute = Color(0xFFC4A48E)

private val scheme = darkColorScheme(
	primary = Ember,
	onPrimary = Paper,
	secondary = Ember2,
	background = Ink,
	onBackground = Paper,
	surface = Panel,
	onSurface = Paper,
	error = Color(0xFFFF6B4A),
)

@Composable
fun PyreTheme(content: @Composable () -> Unit) {
	isSystemInDarkTheme()
	MaterialTheme(colorScheme = scheme, content = content)
}

class MainActivity : ComponentActivity() {
	override fun onCreate(savedInstanceState: Bundle?) {
		enableEdgeToEdge()
		super.onCreate(savedInstanceState)
		WindowCompat.setDecorFitsSystemWindows(window, false)
		window.statusBarColor = android.graphics.Color.parseColor("#140E0B")
		window.navigationBarColor = android.graphics.Color.parseColor("#140E0B")
		WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
		val app = application as PyreApp
		setContent {
			PyreTheme {
				PyreRoot(app.api, app.session)
			}
		}
	}
}
