import apiGooglePhotos from '../helpers/google-photos.js';

let _albums = {};
let _mediaItems = [];

const _fragDiv = document.createElement("div");

function addAlbum(albumId, albumTitle, albumUrl) {
    _albums[albumId] = [albumTitle, albumUrl];
}

function addMediaItems(mediaItems) {
    for (const mi of mediaItems) {
        _mediaItems.push([mi.id, mi.productUrl, mi.description]);
    }
}

function getMediaItemsWithoutDescription() {
    return _mediaItems.filter((item) => !item[2] || item[2].length == 0);
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

async function runAsync(checkSharedAlbums) {
    await requestPagedRecursively('GET', '/albums?pageSize=50', null, async (results) => {
        throwOnResultsError(results);

        if (!results.albums) return;

        for (const a of results.albums) {
            addAlbum(a.id, a.title, a.productUrl);
        }
    });

    if (Object.keys(_albums).length) {
        const table = document.createElement('table'),
              tableId = 'tableAlbumList';

        for (const albumId in _albums) {
            const title = _albums[albumId][0],
                  url = _albums[albumId][1],
                  tr = document.createElement('tr'),
                  tdBtn = document.createElement('td'),
                  btn = document.createElement('button');

            tr.innerHTML =`<td><a href='${url}' target='_blank'>${title}</a></td>`;

            btn.innerText = 'Select';
            btn.addEventListener('click', ev => {
                table.style.display = 'none';
                fetchAlbumMedia(albumId);
            });

            tdBtn.appendChild(btn);
            tr.appendChild(tdBtn);
            table.appendChild(tr);
        }

        table.id = tableId;
        _fragDiv.appendChild(table);

        const frag = document.createDocumentFragment();
        frag.appendChild(_fragDiv);

        return frag;
    }
    else return 'No out-of-album photos found';
}

async function fetchAlbumMedia(albumId) {
    console.log(`fetch media of album ${albumId}`);

    await requestPagedRecursively(
        'POST', '/mediaItems:search', { albumId: albumId, pageSize: 100 },
        async (results) => addMediaItems(results.mediaItems));

    const itemsWithoutDescription = getMediaItemsWithoutDescription();

    if (itemsWithoutDescription.length > 0) {
        console.log(` ${itemsWithoutDescription.length} items without description`);
        displayItemsWithoutDescription(itemsWithoutDescription);
        return;
    } else {
        await reorderItems();
        return;
    }
}

async function reorderItems() {
    const sorted = _mediaItems.toSorted((a, b) => {
        if (a[2] < b[2]) {
            return -1;
        } else if (a[2] > b[2]) {
            return 1;
        } else {
            return 0;
        }
    });

    console.log(sorted);
}

function displayItemsWithoutDescription(items) {
    const table = document.createElement('table'),
          title = document.createElement('h3'),
          tableId = 'missingDescriptionList';

    title.innerText = 'Error: Missing descriptions for following items:'
    _fragDiv.appendChild(title);

    for (const item of items) {
        const url = item[1],
              tr = document.createElement('tr');

        tr.innerHTML =
            `<td><a href='${url}' target='_blank'>${url}</a><td>`;

        table.appendChild(tr);
    }

    table.id = tableId;
    _fragDiv.appendChild(table);
}

export default [
    {
        name: 'Sort album by media description',
        scopes: 'https://www.googleapis.com/auth/photoslibrary.readonly',

        async run() {
            try {
                console.log('sortAlbumByMediaDescription : running');
                const output = await runAsync(false);
                console.log('sortAlbumByMediaDescription : finished');
                return output;
            }
            catch (err) {
                return err.toString();
            }
        }
    }
]