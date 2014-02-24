# URL parameters

    source = URL of the binary to load
    zoom = default zoom level
    lat / lon = default center latitude / longitude
    overlay = URL of a KML to overlay over the map
    time = Animation loop time in ms. Default: 10000
    offset = Time windows size in days. Default: 15
    maxoffset = Max time window size in days (max position for the time window slider). Default: 29

All of them apart from source are optional.


# Source data
Details of the source data format can be found in the comment for
loadTypedMatrix in js/utils.js.

## Required columns

    datetime = Time of sample in seconds since epoch. Data must be ordered by this column!
    latitude = Latitude of sample
    longitude = Longitude of sample

## Optional columns

    red, green, blue = Point color, all three must be present, or none of them. Range: ]0,255[
    alpha = Transparency. Only if red/green/blue are present. Range: ]0,255[
    magnitude = Point size. Range: ]0,255[

The default values will produce a nice orange visualization with
uniformly sized points.