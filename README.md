# SA-Football-Bot
Bot that automatically tweets match data of South African football games



## Overview

This project fetches match data from [FotMob](https://www.fotmob.com/) and renders
match graphics similar to broadcast overlays. The generated image can optionally
be posted to Twitter/X using the Tweepy library.


## Getting started

1. Create and activate a Python 3.11+ virtual environment.
2. Install the project dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Export Twitter credentials (required only when using `--tweet`):

   ```bash
   export TWITTER_API_KEY="..."
   export TWITTER_API_SECRET="..."
   export TWITTER_ACCESS_TOKEN="..."
   export TWITTER_ACCESS_TOKEN_SECRET="..."
   ```

4. Generate a match graphic:

   ```bash
   python -m sa_football_bot.main 4272150 --output burnley-liverpool.png
   ```

5. Post the graphic to Twitter/X:

   ```bash
   python -m sa_football_bot.main 4272150 --tweet
   ```

## Command line options

```
usage: python -m sa_football_bot.main [-h] [--output OUTPUT] [--tweet]
                                      [--stats [STATS ...]]
                                      [--status-text STATUS_TEXT]
                                      match_id
```

* `match_id` – FotMob match identifier.
* `--output` – Optional path where the image should be saved. Defaults to
  `./match_<match_id>.png`.
* `--tweet` – When set, uploads the generated image to Twitter/X using the
  configured credentials.
* `--stats` – Optional list of stat titles to include. When omitted the first
  eight entries from FotMob are used.
* `--status-text` – Provide a custom tweet message when using `--tweet`.

## Development notes

* Network requests include a user agent header to align with FotMob's public
  site usage.
* The graphics module relies on `matplotlib`. Install it before generating
  images.
* `python-dotenv` is included so environment variables can be loaded from a
  local `.env` file during development.
