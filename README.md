## Adding Song
**Link Format**: `URL:8000/insert_song`<br>
**HTTP Method**: `POST`<br>
**Body Format**: 
```
id: [SONG_ID]
artistID: [ARTIST_ID]
title: [SONG_TITLE]
mvLink: [MV_YOUTUBE_LINK]
year: [YEAR]
mvStartTime: [MV_START_TIME]
danceLink: [DANCE_YOUTUBE_;INK]
danceStartTime: [DANCE_START_TIME]
difficulty: [DIFFICULTY]
duration: [DURATION]
```

In order to restart the node server, kill all the node processes.
Then, run the command in the background using:
```
ps aux | grep node
sudo npm start &
```