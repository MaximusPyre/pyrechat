package dev.pyrearms.chat

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject

class SessionStore(context: Context) {
	private val prefs = EncryptedSharedPreferences.create(
		context,
		"pyre_session",
		MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
		EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
		EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
	)

	var token: String?
		get() = prefs.getString("token", null)?.ifBlank { null }
		set(value) {
			prefs.edit().putString("token", value).apply()
		}

	var userJson: String?
		get() = prefs.getString("user", null)?.ifBlank { null }
		set(value) {
			prefs.edit().putString("user", value).apply()
		}

	fun user(): User? = userJson?.let { runCatching { User.from(JSONObject(it)) }.getOrNull() }

	fun save(token: String, user: JSONObject) {
		prefs.edit().putString("token", token).putString("user", user.toString()).apply()
	}

	fun clear() {
		prefs.edit().clear().apply()
	}
}

data class User(
	val id: String,
	val username: String,
	val displayName: String,
	val snapScore: Int,
) {
	companion object {
		fun from(o: JSONObject) = User(
			id = o.optString("id"),
			username = o.optString("username"),
			displayName = o.optString("displayName").ifBlank { o.optString("username") },
			snapScore = o.optInt("snapScore"),
		)
	}
}

data class Friend(
	val id: String,
	val username: String,
	val displayName: String,
) {
	companion object {
		fun from(o: JSONObject) = Friend(
			id = o.optString("id"),
			username = o.optString("username"),
			displayName = o.optString("display_name").ifBlank { o.optString("username") },
		)
	}
}

data class InboxSnap(
	val id: String,
	val username: String,
	val displayName: String,
	val kind: String,
	val caption: String,
	val viewed: Boolean,
	val createdAt: String,
) {
	companion object {
		fun from(o: JSONObject) = InboxSnap(
			id = o.optString("snap_id").ifBlank { o.optString("id") },
			username = o.optString("username"),
			displayName = o.optString("display_name").ifBlank { o.optString("username") },
			kind = o.optString("kind"),
			caption = o.optString("caption"),
			viewed = !o.isNull("viewed_at") && o.optString("viewed_at").isNotBlank(),
			createdAt = o.optString("created_at"),
		)
	}
}

class ApiException(message: String, val status: Int) : Exception(message)
