package dev.pyrearms.chat

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class PyreClient(private val session: SessionStore) {
	val origin = "https://chat.pyrearms.dev"

	private val http = OkHttpClient.Builder()
		.connectTimeout(20, TimeUnit.SECONDS)
		.readTimeout(60, TimeUnit.SECONDS)
		.writeTimeout(60, TimeUnit.SECONDS)
		.build()

	private fun request(path: String): Request.Builder {
		val b = Request.Builder().url("$origin$path")
		session.token?.let { b.header("Authorization", "Bearer $it") }
		return b
	}

	private fun parseError(body: String, code: Int): Nothing {
		val msg = runCatching { JSONObject(body).optString("error") }.getOrNull()?.ifBlank { null }
		throw ApiException(msg ?: "Error $code", code)
	}

	private suspend fun execute(req: Request): String = withContext(Dispatchers.IO) {
		http.newCall(req).execute().use { res ->
			val body = res.body?.string().orEmpty()
			if (!res.isSuccessful) parseError(body, res.code)
			body
		}
	}

	suspend fun get(path: String): JSONObject {
		val raw = execute(request(path).get().build())
		return if (raw.isBlank()) JSONObject() else JSONObject(raw)
	}

	suspend fun post(path: String, json: JSONObject? = null): JSONObject {
		val body = (json?.toString() ?: "{}").toRequestBody("application/json; charset=utf-8".toMediaType())
		val raw = execute(request(path).post(body).build())
		return if (raw.isBlank()) JSONObject() else JSONObject(raw)
	}

	suspend fun upload(bytes: ByteArray, mime: String): JSONObject = withContext(Dispatchers.IO) {
		val req = request("/api/media")
			.post(bytes.toRequestBody(mime.toMediaType()))
			.header("Content-Type", mime)
			.build()
		val raw = execute(req)
		JSONObject(raw)
	}

	suspend fun mediaBytes(path: String): ByteArray = withContext(Dispatchers.IO) {
		val url = if (path.startsWith("http")) path else "$origin$path"
		val b = Request.Builder().url(url)
		session.token?.let { b.header("Authorization", "Bearer $it") }
		http.newCall(b.get().build()).execute().use { res ->
			val bytes = res.body?.bytes() ?: ByteArray(0)
			if (!res.isSuccessful) parseError(String(bytes), res.code)
			bytes
		}
	}

	suspend fun me(): User {
		val o = get("/api/me").getJSONObject("user")
		session.userJson = o.toString()
		return User.from(o)
	}

	suspend fun login(username: String, password: String): Pair<User, String?> {
		val o = post("/api/auth/login", JSONObject().put("username", username).put("password", password))
		return saveAuth(o)
	}

	suspend fun signup(username: String, password: String, displayName: String, birthday: String): Pair<User, String?> {
		val o = post(
			"/api/auth/signup",
			JSONObject()
				.put("username", username)
				.put("password", password)
				.put("displayName", displayName)
				.put("birthday", birthday),
		)
		return saveAuth(o)
	}

	suspend fun recover(username: String, seed: String, password: String): Pair<User, String?> {
		val o = post(
			"/api/auth/recover",
			JSONObject().put("username", username).put("seed", seed).put("password", password),
		)
		return saveAuth(o)
	}

	suspend fun logout() {
		runCatching { post("/api/auth/logout") }
		session.clear()
	}

	suspend fun friends(): List<Friend> {
		val arr = get("/api/friends").optJSONArray("friends") ?: JSONArray()
		return (0 until arr.length()).map { Friend.from(arr.getJSONObject(it)) }
	}

	suspend fun inbox(): List<InboxSnap> {
		val arr = get("/api/inbox").optJSONArray("snaps") ?: JSONArray()
		return (0 until arr.length()).map { InboxSnap.from(arr.getJSONObject(it)) }
	}

	suspend fun snap(id: String): JSONObject = get("/api/snaps/$id")

	suspend fun markViewed(id: String) {
		runCatching { post("/api/snaps/$id/view") }
	}

	suspend fun sendSnap(mediaKey: String, kind: String, recipientIds: List<String>, caption: String) {
		post(
			"/api/snaps",
			JSONObject()
				.put("mediaKey", mediaKey)
				.put("kind", kind)
				.put("caption", caption)
				.put("recipientIds", JSONArray(recipientIds)),
		)
	}

	private fun saveAuth(o: JSONObject): Pair<User, String?> {
		val token = o.optString("token")
		if (token.isBlank()) throw ApiException("No session token", 500)
		val user = o.getJSONObject("user")
		session.save(token, user)
		return User.from(user) to o.optString("recoveryKey").ifBlank { null }
	}
}
