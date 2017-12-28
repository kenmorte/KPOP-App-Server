import csv
import httplib, urllib
import json

def populateArtists():
    URL = 'localhost'
    headers = {'Content-type': 'application/x-www-form-urlencoded'}

    with open('../csv/artists.csv') as csvfile:
        reader = csv.reader(csvfile)
        conn = httplib.HTTPConnection(URL, 8000)
        numberAdded = 0
        print 'Reading artists.csv file...'

        for i, row in enumerate(reader):
            if i == 0 or not row[1]: continue
            
            ID, artist, imageUrl = tuple(row[1:])

            params = urllib.urlencode({'id': int(ID), 'name': artist, 'imageUrl': imageUrl})
            conn.request('POST', '/insert_artist', params, headers)
            response = conn.getresponse()

            data = response.read()
            resp = json.loads(data.decode('utf-8'))

            if resp['success']:
                numberAdded += 1
                print 'Added ', artist + ' to database'
                
        print 'Successfully added', numberAdded, 'artists to database!'
        conn.close()

