# run.py

from backend import createApp

app = createApp()

if __name__ == "__main__":
	app.run(
		host="0.0.0.0",
		port=app.config["PORT"],
		debug=app.config["DEBUG"],
	)
