package dev.pyrearms.chat

import android.app.Application

class PyreApp : Application() {
	lateinit var session: SessionStore
		private set
	lateinit var api: PyreClient
		private set

	override fun onCreate() {
		super.onCreate()
		session = SessionStore(this)
		api = PyreClient(session)
	}
}
