import sys
import requests
import csv
import httplib
import urllib
import json

class InvalidNumberOfArgumentsException(Exception): pass
class BadResponseException(Exception): pass
class InvalidCSVFormatException(Exception): pass
class ResponseFailedException(Exception): pass

SERVER_URL = '18.218.83.175'
SERVER_PORT = 8000
HTTP_HEADER = {'Content-type': 'application/x-www-form-urlencoded'}

def read_playlist(link):
	print 'Requesting playlist...'
	response = requests.get(link)

	if response.status_code != 200:
		raise BadResponseException('Bad response code = ' + response.status_code)

	print 'Parsing playlist...'
	reader = csv.reader(response.content.splitlines())

	name = None
	background_url = None
	image_author = None
	image_source = None
	playlist_id = None
	songs = []

	print 'Getting playlist info...'
	for i, row in enumerate(reader):
		if i == 0:
			_, name = tuple(row)
		elif i == 1:
			_, background_url = tuple(row)
		elif i == 2:
			_, image_source = tuple(row)
		elif i == 3:
			_, image_author = tuple(row)
		elif i > 4:
			title, artist = tuple(row)
			if not title or not artist:
				raise InvalidCSVFormatException('One of the song title or artist fields are empty')
			songs.append((title, artist))

	if not name or not background_url or not image_author or not image_source or not songs:
		raise InvalidCSVFormatException('Please check format of spreadsheet')



	print 'Playlist info gathered!'
	print 'Name = ' + name
	print 'Background URL = ' + background_url
	print 'Image Author = ' + image_author
	print 'Image Source = ' + image_source


	print 'Requesting to add playlist to database...'
	params = urllib.urlencode({
    	'name': name, 
    	'isPreset': True,
        'background_url': background_url, 
        'author': 'Admin Christian', 
        'imageAuthor': image_author,
        'imageSource': image_source
    })
	CONNECTION.request('POST', '/insert_playlist', params, HTTP_HEADER)
	response = CONNECTION.getresponse()

	data = response.read()
	resp = json.loads(data.decode('utf-8'))

	if not resp['success'] and 'playlist_id' not in resp:
		raise ResponseFailedException('Response = ' + str(resp))

	if 'playlist_id' in resp:
		print 'Playlist exists, so going to use its ID.'
	else:
		print 'Successfully added playlist!'
	playlist_id = resp['playlist_id'] if 'playlist_id' in resp else resp['result']['_id']

	print 'Adding songs...'
	for song_title, artist in songs:
		params = urllib.urlencode({
	    	'songTitle': song_title, 
	    	'artistName': artist,
	        'playlistID': playlist_id
	    })
		CONNECTION.request('POST', '/insert_song_by_title_and_artist_in_playlist', params, HTTP_HEADER)
		response = CONNECTION.getresponse()

		data = response.read()
		resp = json.loads(data.decode('utf-8'))

		if not resp['success'] and ('nModified' not in resp['message'] or not bool(resp['message']['nModified'])):
			print 'Failed to add song "' + song_title + '" by ' + artist + ': ' + str(resp['message'])
		else:
			print 'Successfully added song "' + song_title + '" by ' + artist + '!'


if len(sys.argv) != 2:
	raise InvalidNumberOfArgumentsException('Please enter only one argument: The key for the Google spreadsheet')

SPREADSHEET_KEY = sys.argv[1]
SPREADSHEET_LINK = 'https://docs.google.com/spreadsheet/ccc?key=' + SPREADSHEET_KEY + '&output=csv'
CONNECTION = httplib.HTTPConnection(SERVER_URL, SERVER_PORT)

read_playlist(SPREADSHEET_LINK)