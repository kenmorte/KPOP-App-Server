import csv
import httplib, urllib
import json

def populateSongsAndPlaylists():
    URL = '18.218.83.175'
    headers = {'Content-type': 'application/x-www-form-urlencoded'}

    with open('../csv/songs.csv') as csvfile:
        reader = csv.reader(csvfile)
        conn = httplib.HTTPConnection(URL, 8000)
        playlistsAdded = 0
        songsAdded = 0
        playlistIDs = {}
        playlistID = 0

        print 'Reading songs.csv file...'

        for i, row in enumerate(reader):
            if i == 0: continue
            
            _, songTitle, artistName, year, mvLink, mvStartTime, danceLink, danceStartTime, duration, difficulty = tuple(row)
            difficulty = difficulty.strip()

            # We need to add playlist for this difficulty
            if difficulty not in playlistIDs:
                params = urllib.urlencode({'name': difficulty, 'likes': 0, 'plays': 0, 'author': 'Admin Christian', 'isPreset': True, 'songIDs': []})
                conn.request('POST', '/insert_playlist', params, headers)
                response = conn.getresponse()

                data = response.read()
                resp = json.loads(data.decode('utf-8'))

                if resp['success']:
                    playlistsAdded += 1
                    playlistIDs[difficulty] = resp['result']['_id']
                    print 'Playlist "' + difficulty + '" added!'

            print('duration = ', duration)
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
            conn.request('POST', '/insert_song', params, headers)
            response = conn.getresponse()

            data = response.read()
            resp = json.loads(data.decode('utf-8'))

            if resp['success']:
                songsAdded += 1
                songID = resp['result']['_id']

                if difficulty not in playlistIDs:
                    conn.request('GET', '/playlist/' + difficulty + '/true')
                    response = conn.getresponse()

                    data = response.read()
                    resp = json.loads(data.decode('utf-8'))
                    if resp['success']: playlistIDs[difficulty] = resp['result']['_id']                

                playlistID = playlistIDs[difficulty]

                params = urllib.urlencode({'songID': songID, 'playlistID': playlistID})
                conn.request('POST', '/insert_song_in_playlist', params, headers)
                response = conn.getresponse()

                data = response.read()
                resp = json.loads(data.decode('utf-8'))

                print 'Song "' + songTitle + '" added to database and to playlist "' + difficulty + '"!'

        print 'Successfully added', songsAdded, 'songs to database!'
        conn.close()

