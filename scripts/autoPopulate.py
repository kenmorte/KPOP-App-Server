import requests
import csv
import httplib, urllib
import json

SERVER_URL = '18.218.83.175'
SERVER_PORT = 8000
SONGS_URL = 'https://docs.google.com/spreadsheet/ccc?key=1-WGc2MEUHPb_7YjoO5oOalGwsHo7vfTtoQy2em1XEY4&output=csv'
ARTISTS_URL = 'https://docs.google.com/spreadsheet/ccc?key=1ym1X766RZupQFxc9QSsr2QomCqKWuqh8IlElgai8lW0&output=csv'

HTTP_HEADER = {'Content-type': 'application/x-www-form-urlencoded'}

CONNECTION = httplib.HTTPConnection(SERVER_URL, SERVER_PORT)

def read_songs():
	print 'Reading songs spreadsheet...'

	response = requests.get(SONGS_URL)

	if response.status_code != 200:
		return

	reader = csv.reader(response.content.splitlines())
	playlistsAdded = 0
	songsAdded = 0
	playlistIDs = {}
	playlistID = 0

	for i, row in enumerate(reader):
		if i == 0: continue
	    
		_, songTitle, artistName, year, mvLink, mvStartTime, danceLink, danceStartTime, duration, difficulty = tuple(row)
		difficulty = difficulty.strip()

		# We need to add playlist for this difficulty
		if difficulty not in playlistIDs:
			print 'Attempting to add difficulty "' + difficulty + '"...'

			params = urllib.urlencode({'name': difficulty, 'likes': 0, 'plays': 0, 'author': 'Admin Christian', 'isPreset': True, 'songIDs': []})
			CONNECTION.request('POST', '/insert_playlist', params, HTTP_HEADER)
			response = CONNECTION.getresponse()

			data = response.read()
			resp = json.loads(data.decode('utf-8'))

			if resp['success']:
				playlistsAdded += 1
				playlistIDs[difficulty] = resp['result']['_id']
				print 'Playlist "' + difficulty + '" added!'

		print 'Attempting to add song "' + songTitle + '"...'

		params = urllib.urlencode({
        	'title': songTitle, 
	        'artistName': artistName, 
	        'year': int(year), 
	        'mvLink': mvLink,
	        'mvStartTime': float(mvStartTime),
	        'danceLink': danceLink,
	        'danceStartTime': float(danceStartTime),
	        'difficulty': difficulty,
	        'duration': float(duration)
	    })

		CONNECTION.request('POST', '/insert_song', params, HTTP_HEADER)
		response = CONNECTION.getresponse()

		data = response.read()
		resp = json.loads(data.decode('utf-8'))

		if resp['success']:
			songsAdded += 1
			songID = resp['result']['_id']

			if difficulty not in playlistIDs:
				CONNECTION.request('GET', '/playlist/' + difficulty + '/true')
				response = CONNECTION.getresponse()

				data = response.read()
				resp = json.loads(data.decode('utf-8'))
				if resp['success']: playlistIDs[difficulty] = resp['result']['_id']                

			playlistID = playlistIDs[difficulty]

			params = urllib.urlencode({'songID': songID, 'playlistID': playlistID})
			CONNECTION.request('POST', '/insert_song_in_playlist', params, HTTP_HEADER)
			response = CONNECTION.getresponse()

			data = response.read()
			resp = json.loads(data.decode('utf-8'))

			print 'Song "' + songTitle + '" added to database and to playlist "' + difficulty + '"!'
		else:
			print 'Failed to add song "' + songTitle + '"'

	print 'Successfully added', songsAdded, 'songs to database!'

def read_artists():
	print 'Reading artists spreadsheet...'

	response = requests.get(ARTISTS_URL)

	if response.status_code != 200:
		return

	reader = csv.reader(response.content.splitlines())
	numberAdded = 0

	for i, row in enumerate(reader):
	    if i == 0 or not row[1]: continue
	    
	    ID, artist, imageUrl, author, source, artistType = tuple(row[1:])

	    print 'Attempting to add "' + artist + '"...'

	    params = urllib.urlencode({'id': int(ID), 'name': artist, 'imageUrl': imageUrl, 'author': author, 'source': source, 'type': artistType})
	    CONNECTION.request('POST', '/insert_artist', params, HTTP_HEADER)
	    response = CONNECTION.getresponse()

	    data = response.read()
	    resp = json.loads(data.decode('utf-8'))

	    if resp['success']:
	        numberAdded += 1
	        print 'Added ', artist + ' to database'
                
	print 'Successfully added', numberAdded, 'artists to database!'

def closeConnection(): CONNECTION.close()

read_artists()
read_songs()
closeConnection()