package dev.pyrearms.chat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import dev.pyrearms.chat.ui.theme.PyreColor
import dev.pyrearms.chat.ui.theme.PyreTheme

class MainActivity : ComponentActivity() {
	override fun onCreate(savedInstanceState: Bundle?) {
		enableEdgeToEdge()
		super.onCreate(savedInstanceState)
		WindowCompat.setDecorFitsSystemWindows(window, false)
		window.statusBarColor = android.graphics.Color.TRANSPARENT
		window.navigationBarColor = android.graphics.Color.TRANSPARENT
		WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
		val app = application as PyreApp
		setContent {
			PyreTheme {
				PyreRoot(app.api, app.session)
			}
		}
	}
}
