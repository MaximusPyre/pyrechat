package dev.pyrearms.chat

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
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

data class ChatMember(
	val id: String,
	val username: String,
	val displayName: String,
) {
	companion object {
		fun from(o: JSONObject) = ChatMember(
			id = o.optString("id"),
			username = o.optString("username"),
			displayName = o.optString("display_name").ifBlank { o.optString("username") },
		)
	}
}

data class ChatRow(
	val id: String,
	val isGroup: Boolean,
	val name: String?,
	val members: List<ChatMember>,
	val lastBody: String?,
	val lastKind: String?,
	val lastAt: String?,
	val lastSenderId: String?,
	val unopenedSnaps: Int,
	val streak: Int,
) {
	val title: String
		get() = if (isGroup) name ?: "Group" else members.firstOrNull()?.displayName ?: "Chat"

	val subtitle: String
		get() = when {
			unopenedSnaps > 0 -> "New Pyre"
			lastKind == "text" && !lastBody.isNullOrBlank() -> lastBody!!
			lastKind != null -> lastKind!!.replaceFirstChar { it.uppercase() }
			else -> "Tap to chat"
		}

	companion object {
		fun from(o: JSONObject): ChatRow {
			val membersArr = o.optJSONArray("members") ?: JSONArray()
			val members = (0 until membersArr.length()).map { ChatMember.from(membersArr.getJSONObject(it)) }
			val last = o.optJSONObject("last")
			return ChatRow(
				id = o.optString("id"),
				isGroup = o.optInt("is_group") == 1,
				name = o.optString("name").ifBlank { null },
				members = members,
				lastBody = last?.optString("body"),
				lastKind = last?.optString("kind"),
				lastAt = last?.optString("created_at"),
				lastSenderId = last?.optString("sender_id"),
				unopenedSnaps = o.optInt("unopenedSnaps"),
				streak = o.optInt("streak"),
			)
		}
	}
}

data class ChatMessage(
	val id: String,
	val senderId: String,
	val displayName: String,
	val kind: String,
	val body: String,
	val createdAt: String,
) {
	companion object {
		fun from(o: JSONObject) = ChatMessage(
			id = o.optString("id"),
			senderId = o.optString("sender_id"),
			displayName = o.optString("display_name").ifBlank { o.optString("username") },
			kind = o.optString("kind"),
			body = o.optString("body"),
			createdAt = o.optString("created_at"),
		)
	}
}

class ApiException(message: String, val status: Int) : Exception(message)
