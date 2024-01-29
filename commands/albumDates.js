import apiGooglePhotos from '../helpers/google-photos.js';

let _albums = {};

function addDatesToAlbum(albumId, albumName, albumUrl, mediaItems) {
    if (!mediaItems) { return; }

    for (const mi of mediaItems) {
        const thisDate = new Date(mi.mediaMetadata.creationTime);

        if (!_albums[albumId]) {
            _albums[albumId] = [albumName, albumUrl, thisDate, thisDate];

        } else {
            if (_albums[albumId][2] > thisDate) {
                _albums[albumId][2] = thisDate;
            }
            if (_albums[albumId][3] < thisDate) {
                _albums[albumId][3] = thisDate;
            }
        }
    }
}

async function requestPagedRecursively(method, path, body, processResults, pageToken) {
    let url = path;

    if (pageToken) {
        if (method === 'GET') {
            if (!path.endsWith('&') && !path.endsWith('?')) {
                url += (path.indexOf('?') >= 0) ? '&' : '?';
            }

            url += `pageToken=${pageToken}`;
        }
        else {
            body = body || {};
            body.pageToken = pageToken;
        }
    }

    return apiGooglePhotos.request(method, url, body)
        .then(async (results) => {
            throwOnResultsError(results);

            await processResults(results);

            if (results.nextPageToken) {
                return requestPagedRecursively(method, path, body, processResults, results.nextPageToken);
            }
        });
}

function throwOnResultsError(results) {
    if (results.error) {
        throw new Error(`${results.error.code} : ${results.error.status} : ${results.error.message}`);
    }
}

function albumExpectedRange(albumName) {
    const rx = new RegExp("^([0-9 \-]*) - .*");

    const res = rx.exec(albumName);
    if (!res) return [false];

    const fullDate = res[1];

    const singleDateRx = new RegExp("^([0-9]{4}) ([0-9]{2}) ([0-9]{2})$");
    const resSingleDate = singleDateRx.exec(fullDate);
    if (resSingleDate) {
        return [true, new Date(fullDate), new Date(fullDate)];
    }

    const severalDaysRx = new RegExp("^([0-9]{4}) ([0-9]{2}) ([0-9]{2})-([0-9]{2})$");
    const mDays = severalDaysRx.exec(fullDate);
    if (mDays) {
        return [true, new Date(`${mDays[1]} ${mDays[2]} ${mDays[3]}`), new Date(`${mDays[1]} ${mDays[2]} ${mDays[4]}`)];
    }

    const severalMonthsRx = new RegExp("^([0-9]{4}) ([0-9]{2}) ([0-9]{2})-([0-9]{2}) ([0-9]{2})$");
    const mMonths = severalMonthsRx.exec(fullDate);
    if (mMonths) {
        return [true, new Date(`${mMonths[1]} ${mMonths[2]} ${mMonths[3]}`), new Date(`${mMonths[1]} ${mMonths[4]} ${mMonths[5]}`)];
    }

    const severalYearsRx = new RegExp("^([0-9]{4}) ([0-9]{2}) ([0-9]{2})-([0-9]{4}) ([0-9]{2}) ([0-9]{2})$");
    const mYears = severalYearsRx.exec(fullDate);
    if (mYears) {
        return [true, new Date(`${mYears[1]} ${mYears[2]} ${mYears[3]}`), new Date(`${mYears[4]} ${mYears[5]} ${mYears[6]}`)];
    }

    return [false];
}

async function runAsync(checkSharedAlbums) {
    await requestPagedRecursively('GET', '/albums?pageSize=50', null, async (results) => {
        throwOnResultsError(results);

        if (!results.albums) return;

        for (const a of results.albums) {
            await requestPagedRecursively(
                'POST', '/mediaItems:search', { albumId: a.id, pageSize: 100 },
                async (results) => addDatesToAlbum(a.id, a.title, a.productUrl, results.mediaItems));
        }
    });

    if (checkSharedAlbums) {
        await requestPagedRecursively('GET', '/sharedAlbums?pageSize=50', null, async (results) => {
            throwOnResultsError(results);

            if (!results.sharedAlbums) return;

            for (const a of results.sharedAlbums) {
                await requestPagedRecursively(
                    'POST', '/mediaItems:search', { albumId: a.id, pageSize: 100 },
                    async (results) => addDatesToAlbum(a.id, a.title, a.productUrl, results.mediaItems));
            }
        });
    }

    if (Object.keys(_albums).length) {
        const frag = document.createDocumentFragment(),
              table = document.createElement('table'),
              tableId = 'tableFindOutOfAlbumPhotos';

        for (const id in _albums) {
            const title = _albums[id][0],
                  url = _albums[id][1],
                  dateMin = _albums[id][2],
                  dateMax = _albums[id][3],
                  tr = document.createElement('tr');

            const durationDays = Math.round((dateMax - dateMin) / 1000 / 86400);

            const expectedRange = albumExpectedRange(title);

            let color = "";
            let daysOutsideRange = 0;
            let daysOutsideRangeStr = "";
            if (!expectedRange[0]) {
                color = "#fbff9d"; //yellow
            } else {
                if (dateMin > expectedRange[1] && dateMax - expectedRange[2] < 86400*1000 + 43200*1000) { // 12h tolerance for end of night
                    color = "#b8ff9d"; //green
                } else {
                    color = "#ff9d9d"; //red
                    daysOutsideRange = Math.round(Math.max(expectedRange[1] - dateMin, dateMax - expectedRange[2]) / 1000 / 86400);
                    daysOutsideRangeStr = `${daysOutsideRange} days outside range`;
                }
            }

            tr.style.backgroundColor = color;

            tr.innerHTML =
                `<td><a href='${url}' target='_blank'>${title}</a></td>
                <td>${durationDays} days</td>
                <td>${dateMin.toLocaleString().substr(0, 24)} - ${dateMax.toLocaleString().substr(0, 24)}</td>
                <td>${daysOutsideRangeStr}</td>`;

            table.appendChild(tr);
        }

        frag.appendChild(createSaveLink(tableId));

        table.id = tableId;
        frag.appendChild(table);

        return frag;
    }
    else return 'No out-of-album photos found';
}
function createSaveLink(tableId) {
    const divContainer = document.createElement('div'),
          btnSave = document.createElement('button');

    divContainer.style = 'margin-bottom:1em;';
    btnSave.innerText = 'Save';

    btnSave.addEventListener('click', ev => {
        const eleTable = document.getElementById(tableId);
        if (!eleTable) {
            console.error('findOutOfAlbumPhotos:createSaveLink:click{table does not exist}', tableId);
            return;
        }

        const outputData = `<html><body>${eleTable.outerHTML}</body></html>`;

        const aDownload = document.createElement('a');
        aDownload.setAttribute('download', 'output.html');
        aDownload.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(outputData));
        aDownload.style = 'display:none';

        document.body.appendChild(aDownload);
        aDownload.click();
        document.body.removeChild(aDownload);
    });

    divContainer.appendChild(btnSave);
    return divContainer;
}

export default [
    {
        name: 'Album min & max dates',
        scopes: 'https://www.googleapis.com/auth/photoslibrary.readonly',

        async run() {
            try {
                console.log('albumDates : running');
                const output = await runAsync(false);
                console.log('albumDates : finished');
                return output;
            }
            catch (err) {
                return err.toString();
            }
        }
    },
    {
        name: 'Album min & max dates (including "shared" albums)',
        scopes: 'https://www.googleapis.com/auth/photoslibrary.readonly',

        async run() {
            try {
                console.log('albumDates(w/shared) : running');
                const output = await runAsync(true);
                console.log('albumDates(w/shared) : finished');
                return output;
            }
            catch (err) {
                return err.toString();
            }
        }
    }
]