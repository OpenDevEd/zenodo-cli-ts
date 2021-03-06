import axios from 'axios';
// import { debug as debug } from 'console';
import * as fs from "fs";
import opn from 'opn';
//for catch:
//import { catchError } from 'rxjs/operators';
//for throw:
//import { Observable, throwError } from 'rxjs';

import {
  dumpJSON,
  loadConfig,
  parseId,
  parseIds,
  showDepositionJSON,
  updateMetadata,
  mydebug,
  myverbose
} from "./helper";

async function apiCall(args, options, fullResponse = false) {
  console.log(`API CALL`)
  mydebug(args, "apiCall: args=", args)
  mydebug(args, "apiCall: options=", options)
  mydebug(args, "apiCall: fullResponse=", fullResponse)
  try {
    const resData = await axios(options).then(res => {
      console.log("axios.then->response")
      if ("verbose" in args && args.verbose) {
        console.log(`response status code: ${res.status}`)
        console.log(`response status text: ${res.statusText}`)
        zenodoMessage(res.status)
        console.log(`keys: ${Object.keys(res)}`)
      }
      mydebug(args, "apiCall: response=", res.headers)
      if (fullResponse) {
        return res;
      } else {
        return res.data;
      }
    }).catch(function (err) {
      console.log("axios.catch->response")
      if ("verbose" in args && args.verbose) {
        console.log(err);
      }
      axiosError(err)
      return null
    });
    mydebug(args, "apiCall: data", resData)
    return resData
  } catch (e) {
    console.log("ERROR")
    mydebug(args, "error in calling axios", e)
    return null
  }
}

//Note: This is API call for [File upload] because the [header] is different in this case.

async function apiCallFileUpload(args, options, fullResponse = false) {
  const payload = { "data": options.data }
  const destination = options.url
  const axiosoptions = { headers: { 'Content-Type': "application/octet-stream" }, params: options.params }
  console.log(`API CALL`)
  const resData = await axios.put(destination, payload, axiosoptions).then(res => {
    if ("verbose" in args && args.verbose) {
      console.log(`response status code: ${res.status}`)
      zenodoMessage(res.status)
    }
    if (fullResponse) {
      return res;
    } else {
      return res.data;
    }
  }).catch(function (err) {
    if ("verbose" in args && args.verbose) {
      console.log(err);
    }
    axiosError(err)
  });

  return resData;

}


async function publishDeposition(args, id) {
  id = parseId(id);
  const { zenodoAPIUrl, params } = loadConfig(args.config);
  if ("verbose" in args && args.verbose) {
    console.log(`publishDeposition`)
  }
  const options = {
    method: 'post',
    url: `${zenodoAPIUrl}/${id}/actions/publish`,
    params: params,
    headers: { 'Content-Type': "application/json" },
  }
  const responseDataFromAPIcall = await apiCall(args, options);
  return responseDataFromAPIcall;
}

async function showDeposition(args, id) {
  const info = await getData(args, parseId(id));
  showDepositionJSON(info);
}

async function getData(args, id) {
  const { zenodoAPIUrl, params } = loadConfig(args.config);
  myverbose(args, `getting data for ${id}`, null);
  id = parseId(id);
  myverbose(args, `getting data for ${id}`, null);
  let options = {
    method: 'get',
    url: `${zenodoAPIUrl}`,
    params: params,
    headers: { 'Content-Type': "application/json" },
  }
  //Checking Concept. 
  options["params"]["q"] = String("conceptrecid:" + id + " OR recid:" + id);
  //const searchParams = { params };
  //searchParams["q"] = String("conceptrecid:" + id + " OR recid:" + id);
  try {
    //const responseDataFromAPIcall = await axios.get(`${zenodoAPIUrl}`, searchParams)
    const responseDataFromAPIcall = await apiCall(args, options)
    console.log("Response array: " + responseDataFromAPIcall.length)
    if (responseDataFromAPIcall.length == 0) {
      console.log("Response array: " + JSON.stringify(responseDataFromAPIcall))
      console.log("ERROR getData/responseDataFromAPIcall (2).")
      process.exit(1)
    } else {
      if (responseDataFromAPIcall[0].record_id != id) {
        if (!args.allowconceptids) {
          console.log(`Note: Concept id provided (${responseDataFromAPIcall[0].conceptrecid}). Record ID is ${responseDataFromAPIcall[0].record_id}.`)
          // console.log( `In order to operate on records specified by conceptid, please add the following switch: --allowconceptids `)
        }
        // id = responseDataFromAPIcall[0].record_id
      }
      myverbose(args, "final data: ", responseDataFromAPIcall[0])
      return responseDataFromAPIcall[0]
    }
  } catch (error) {
    console.log("ERROR getData/responseDataFromAPIcall: " + error)
    process.exit(1)
  }
}



async function getMetadata(args, id) {
  return await getData(args, id)["metadata"];
}

async function createRecord(args, metadata) {
  console.log("Creating record.");
  mydebug(args, "zenodo.createRecord", args)
  const { zenodoAPIUrl, params } = loadConfig(args.config);
  /* 
    console.log(`URI:    ${zenodoAPIUrl}`)
    const zenodoAPIUrlWithToken = zenodoAPIUrl+"?access_token="+params["access_token"]

    At present, the file blank.json is used as a default, therefore the checks below will pass.
    However, blank.json does not contain a date - Zenodo will use todays date
    const requiredMetadataFields = ["title", "description", "authors"]
    var raiseErrorMissingMetadata = false
    requiredMetadataFields.forEach(metadatafield => {
    if (!(metadatafield in metadata)) {
      console.log(`To create a new record, you need to supply the ${metadatafield}.`);
      raiseErrorMissingMetadata = true
      }  else {
       console.log(`Go to ${metadatafield} = ${metadata[metadatafield]}`)
      }
    });
    if (raiseErrorMissingMetadata) {
     console.log("One or more required fields are missing. Please consult 'create -h'.")
     process.exit(1)
    } 

   */
  const payload = { "metadata": metadata }
  //console.log(JSON.stringify(payload))
  const options = {
    method: "post",
    url: zenodoAPIUrl,
    params: params,
    headers: { 'Content-Type': "application/json" },
    data: payload
  }

  const responseDataFromAPIcall = await apiCall(args, options);
  mydebug(args, "zenodo.createRecord/final", responseDataFromAPIcall)

  return responseDataFromAPIcall;

}


async function editDeposit(args, dep_id) {
  /*
  Unlock already submitted deposition for editing.
  
  curl -i -X POST https://zenodo.org/api/deposit/depositions/1234/actions/edit?access_token=ACCESS_TOKEN
  HTTP Request
  POST /api/deposit/depositions/:id/actions/edit
  
  Scopes
  deposit:actions
  
  Success response
  Code: 201 Created
  Body: a deposition resource.
  */
  console.log("\tMaking deposit editable (actions/edit).");
  const { params, zenodoAPIUrl } = loadConfig(args.config);
  const options = {
    method: 'post',
    url: `${zenodoAPIUrl}/${parseId(dep_id)}/actions/edit`,
    params: params,
    headers: { 'Content-Type': "application/json" },
  }
  const responseDataFromAPIcall = await apiCall(args, options, false);
  return responseDataFromAPIcall;

}

async function updateRecord(args, dep_id, metadata) {

  console.log("Updating record.");
  //-->
  const { params, zenodoAPIUrl } = loadConfig(args.config);
  const payload = { "metadata": metadata }
  const options = {
    method: 'put',
    url: `${zenodoAPIUrl}/${parseId(dep_id)}`,
    params: params,
    headers: { 'Content-Type': "application/json" },
    data: payload
  }

  const responseDataFromAPIcall = await apiCall(args, options);

  return responseDataFromAPIcall;
}


async function fileUpload(args, bucket_url, journal_filepath) {
  const { params } = loadConfig(args.config);
  console.log("Uploading file.");
  const fileName = journal_filepath.replace("^.*\\/", "");
  console.log(`----------> ${journal_filepath}`)
  const data = fs.readFileSync(journal_filepath, 'binary');
  //console.log(data)
  const destination = `${bucket_url}/${fileName}`
  const options = {
    method: 'put',
    url: destination,
    params: params,
    header: { 'Content-Type': "application/octet-stream" },
    data: data

  }

  const responseDataFromAPIcall = await apiCallFileUpload(args, options);

  console.log("UploadSuccessfully.");
  console.log(`${destination}`)
  return responseDataFromAPIcall
}

async function finalActions(args, id, deposit_url) {
  return finalActions2(args,
    {
      id: id,
      links: { html: deposit_url }
    }
  )
}

async function finalActions2(args, data) {
  mydebug(args, "finalActions2", data)
  // the record need to contains files.
  // TODO: Whether whethr this is the case?
  let return_value = data
  const id = data["id"]
  const deposit_url = data["links"]["html"]
  if (("publish" in args) && args.publish) {
    // publishDeposition will change the data, hence collecting return_value
    return_value = await publishDeposition(args, id);
    if ((return_value["state"] == "done" && return_value["submitted"])) {
      console.log("Record published successfully.")
    } else {
      console.log("ERROR IN PUBLISHING RECORD.")
    }
  }
  if (("show" in args) && args.show) {
    await showDeposition(args, id);
  }
  if (("dump" in args) && args.dump) {
    await dumpDeposition(args, id);
  }
  if (("open" in args) && args.open) {
    //webbrowser.open_new_tab(deposit_url);
    opn(deposit_url);
  }
  mydebug(args, "finalActions2, return value = ", return_value)
  return return_value
}

// Top-level function - "zenodo-cli get'
export async function getRecord(args) {
  let data, ids;
  ids = parseIds(args.id);
  ids.forEach(async function (id) {
    data = await getData(args, id);
    mydebug(args, "getRecord", data)
    if (id != data.record_id) {
      if (args.allowconceptids) {
        console.log(`Notice: Concept id provided (${data.conceptrecid}). Using record ID instead (${data.record_id}).`)
        id = data.record_id
      } else {
        console.log(`WARNING: concept id provided (${data.conceptrecid}). Record ID is ${data.record_id}.`)
        console.log(` In order to operate on records specified by conceptid, please add the following switch: --allowconceptids `)
        process.exit(1)
      }
    }
    let path = `${id}.json`;
    let buffer = Buffer.from(JSON.stringify(data["metadata"]));
    fs.open(path, 'w', function (err, fd) {
      if (err) {
        throw 'could not open file: ' + err;
      }
      /*
       write the contents of the buffer, from position 0 to the end, to the file descriptor 
      returned in opening our file
      */
      fs.write(fd, buffer, 0, buffer.length, null, function (err) {
        if (err) throw 'error writing file: ' + err;
        fs.close(fd, function () {
          console.log('wrote the file successfully');
        });
      });
    });
    await finalActions2(args, data);
  })
}

export async function dumpDeposition(args, id) {
  const info = await getData(args, parseId(id));
  dumpJSON(info);
}

export async function duplicate(args) {
  let bucket_url, deposit_url, metadata, response_data;
  let data = await getData(args, args.id[0]);
  //getMetadata(args,args.id[0]);
  metadata = data["metadata"];
  //console.log(metadata);
  delete metadata["doi"];
  metadata["prereserve_doi"] = true;
  //console.log(metadata);
  metadata = updateMetadata(args, metadata);
  response_data = await createRecord(args, metadata);
  //console.log(response_data);
  bucket_url = response_data["links"]["bucket"];
  deposit_url = response_data["links"]["html"];
  if (args.files) {
    args.files.forEach(async function (filePath) {
      await fileUpload(args, bucket_url, filePath);
    }).then(async () => {
      await finalActions(args, response_data["id"], deposit_url);
    });
  }
  await finalActions(args, response_data["id"], deposit_url);
}

export async function upload(args) {
  let bucket_url, deposit_url, response;
  bucket_url = null;
  if (args.bucketurl) {
    bucket_url = args.bucketurl;
  } else {
    if (args.id) {
      response = getData(args, args.id);
      bucket_url = response["links"]["bucket"];
      deposit_url = response["links"]["html"];
    }
  }
  if (bucket_url) {
    args.files.forEach(async function (filePath) {
      await fileUpload(args, bucket_url, filePath);
    })
    await finalActions(args, args.id, deposit_url);
  } else {
    console.log("Unable to upload: id and bucketurl both not specified.");
  }
}

// Top-level function - "zenodo-cli update'
export async function update(args) {
  let bucket_url, data, deposit_url, id;
  let metadata;

  id = parseIds(args.id);
  data = await getData(args, id);
  //console.log(data)
  metadata = data["metadata"];
  //console.log(metadata);
  if (data.submitted == true && data.state == 'done') {
    console.log("\tMaking record editable.");
    let response = await editDeposit(args, id);
    console.log(`response editDeposit:${response}`);
  }

  let responseUpdateRecord = {}
  // Only update metadata if an update is passed.
  if (args.title || args.authors || args.description || args.date
    || args.add_communities || args.remove_communities || args.communities
    || args.zotero_link
    ) {
    const metadataNew = await updateMetadata(args, metadata);
    responseUpdateRecord = await updateRecord(args, id, metadataNew);
  }

  if (args.files) {
    bucket_url = responseUpdateRecord["links"]["bucket"];
    deposit_url = responseUpdateRecord["links"]["html"];
    args.files.forEach(async function (filePath) {
      await fileUpload(args, bucket_url, filePath).then(async () => {
        // TO DO:DONE
        // Wait for promises to complete before calling final actions:
          await finalActions(args, id, deposit_url);
      });
    })
  }
  // As top-level function, execute final actions.
  await finalActions(args, id, deposit_url);
}

export async function copy(args) {
  var bucket_url, metadata, response_data;
  metadata = getMetadata(args, args.id);
  delete metadata["doi"];
  delete metadata["prereserve_doi"];
  var arr = args.files
  arr.forEach(async function (journal_filepath) {
    console.log(("Processing: " + journal_filepath));
    response_data = await createRecord(args, metadata);
    bucket_url = response_data["links"]["bucket"];
    await fileUpload(args, bucket_url, journal_filepath);
    await finalActions(args, response_data["id"], response_data["links"]["html"]);
  });
}

// Top-level function - "zenodo-cli list'
export async function listDepositions(args) {
  mydebug(args, "listDepositions", args)
  const { zenodoAPIUrl, params } = loadConfig(args.config);
  params["page"] = args.page;
  params["size"] = (args.size ? args.size : 1000);
  const options = {
    method: 'get',
    url: zenodoAPIUrl,
    params: params
  }
  const res = await apiCall(args, options);
  mydebug(args, "listDepositions: apiCall", res)
  // Perform a separate dump to capture this response.
  if ("dump" in args && args.dump) {
    dumpJSON(res);
  }
  if ("publish" in args && args.publish) {
    console.log("Warning: using 'list' with '--publish' means that all of your depositions will be published. Please confirm by typing yes.");
    // TODO
    // Capture user input. If yser types yes, continue. If user types anything else, then abort.  
    /* 
    var stdin = process.openStdin();
    stdin.addListener("data", function(d) {
      // note:  d is an object, and when converted to a string it will
      // end with a linefeed.  so we (rather crudely) account for that  
      // with toString() and then substring() 
      console.log("you entered: [" + d.toString().trim() + "]");
    }); 
    */
  }
  if (res.length > 0) {
    var newres = []
    await res.forEach(async function (item) {
      console.log(item["record_id"], item["conceptrecid"]);
      const resfa = finalActions2(args, item);
      newres.push(resfa);
    });
    // TODO - check. This is the right array, but not contains a promise... 
    mydebug(args, "listDepositions: final", newres)
    return newres;
  }
  // return data to calling function:
  return res
}

export async function newVersion(args) {
  const { zenodoAPIUrl, params } = loadConfig(args.config);
  const id = parseId(args.id[0]);
  // Let's check a new version is possible.
  const data = await getData(args, id)
  if (!(data["state"] == "done" && data["submitted"])) {
    console.log("This record is not final - cannot create new version.")
    return null
  }
  // New version is possible - make one.
  const options = {
    method: 'post',
    url: `${zenodoAPIUrl}/${id}/actions/newversion`,
    params: params,
    headers: { 'Content-Type': "application/json" },
  }
  const responseDataFromAPIcall = await apiCall(args, options);
  console.log(responseDataFromAPIcall);
  //return responseDataFromAPIcall;
  let response_data = responseDataFromAPIcall;
  const metadata = responseDataFromAPIcall["metadata"];
  const newmetadata = updateMetadata(args, metadata);
  if ((newmetadata !== metadata)) {
    response_data = updateRecord(args, id, newmetadata);
  }
  const bucket_url = response_data["links"]["bucket"];
  const deposit_url = response_data["links"]["latest_html"];
  if (args.files) {
    args.files.forEach(async function (filePath) {
      await fileUpload(args, bucket_url, filePath);
    }).then(async () => {
      //await finalActions(args, response_data["id"], deposit_url);
      //console.log("latest_draft: ", response_data["links"]["latest_draft"]);
    });
  }
  await finalActions(args, response_data["id"], deposit_url);
  console.log("latest_draft: ", response_data["links"]["latest_draft"]);
}

export async function download(args) {
  var data, id, name;
  id = parseId(args.id[0]);
  data = await getData(args, id);
  const { params } = loadConfig(args.config);
  //IF NO uploaded files: data["files"] => undefined.
  if (data["files"]) { //the record should be [published] to have this option.
    data["files"].forEach(async function (fileObj) {
      name = fileObj["filename"];
      console.log(`Downloading ${name}`);
      const res = await axios.get(fileObj["links"]["download"], { "params": params });

      fs.open(name, 'wx+', (err, fd) => {

        if (err) {
          console.log(err);
        } else {
          //uniquely referencing a specific file.
          console.log(fd);
          let buf = Buffer.from(res.data),
            pos = 0, offset = 0,
            len = buf.length
          fs.write(fd, buf, offset, len, pos,
            (err, bytes, buff) => {
              let buf2 = Buffer.alloc(len);
              //testing
              fs.read(fd, buf2, offset, len, pos,
                (err, bytes, buff2) => {
                  console.log(buff2.toString());
                });
              //testing
            });
        }

      });

      //----------checksum


      fs.open(name + ".md5", 'w+', (err, fd) => {

        if (err) {
          console.log(err);
        } else {
          //uniquely referencing a specific file.
          console.log(fd);
          let buf = Buffer.from((fileObj["checksum"] + " ") + fileObj["filename"]),
            pos = 0, offset = 0,
            len = buf.length
          fs.write(fd, buf, offset, len, pos,
            (err, bytes, buff) => {
              let buf2 = Buffer.alloc(len);
              //testing
              fs.read(fd, buf2, offset, len, pos,
                (err, bytes, buff2) => {
                  console.log(buff2.toString());
                });
              //testing
            });
        }
      });

    });


  } else {

    console.log("the record should be published and files uploaded")

  }

  /*
  OLD code:
 
    data["files"].forEach(async function (fileObj) {
    name = fileObj["filename"];
    console.log(`Downloading ${name}`);
    const res = await axios.get(fileObj["links"]["download"], { "params": params });
    fp = open(name, "wb+");
    fp.write(res.data);
    fp.close();
    fp = open((name + ".md5"), "w+");
    fp.write(((fileObj["checksum"] + " ") + fileObj["filename"]));
    fp.close();
  })
 
 
 
  */

}

export async function concept(args) {
  const { zenodoAPIUrl, params } = loadConfig(args.config);
  params["q"] = `conceptrecid:${parseId(args.id[0])}`;
  const res = await axios.get(zenodoAPIUrl, { "params": params });
  if ((res.status !== 200)) {
    console.log(`Failed in concept(args): `, res.data);
    process.exit(1);
  }
  if ("dump" in args && args.dump) {
    dumpJSON(res.data);
  }
  res.data.forEach(async function (dep) {
    console.log(dep["record_id"], dep["conceptrecid"]);
    // TODO replace what's below with finalactions.
    if ("publish" in args && args.publish) {
      await publishDeposition(args, dep["id"]);
    }
    if ("show" in args && args.show) {
      showDepositionJSON(dep);
    }
    if ("open" in args && args.open) {
      opn(dep["links"]["html"]);
    }
  })
}

// Top-level function - "zenodo-cli create'
export async function create(args) {
  mydebug(args, "zenodo.create", args)
  // Note that Zenodo does not require a date or a DOI, but it will generate those on creation.
  const blankJson = `{
    "access_right": "open",
    "creators": [
      {
          "name": "No name available.",
          "affiliation": "No affiliation available."
      }
    ],
    "title": "No title available.",
    "description": "No description available.",
    "communities": [
      {
        "identifier": "zenodo"
      }
    ],
    "doi": "",
    "publication_type": "report",
    "upload_type": "publication"
  }
  `;
  //const f = fs.readFileSync("blank.json", { encoding: 'utf8' });
  const metadata = updateMetadata(args, JSON.parse(blankJson));
  let response_data;
  response_data = await createRecord(args, metadata);
  console.log("RESP: " + response_data)
  let response_data_2 = null
  if (response_data) {
    response_data_2 = await finalActions2(args, response_data);
  } else {
    console.log("Record creation failed.")
  }
  if (response_data_2) {
    response_data = response_data_2
  }
  mydebug(args, "zenodo.create/final", response_data)
  return response_data
}


async function axiosError(error) {
  if (error.response) {
    console.log("The request was made and the server responded with a status code that falls out of the range of 2xx")
    console.log(`ZENODO: Error in creating new record (other than 2xx)`);
    console.log("ZENODO: List of error codes: https://developers.zenodo.org/?shell#http-status-codes");
    console.log("status:" + error.response.status);
    zenodoMessage(error.response.status);
    console.log('Error1', error.message);
    console.log('Error2', JSON.stringify(error.response.errors));
    console.log('Error3', error.response.data.status);
    console.log('Error4', error.response.data.message);
    // if (verbose) {
    //  console.log(error.response.data);
    //  console.log(error.response.headers)
    // }
  } else if (error.request) {
    console.log(`The request was made but no response was received
    'error.request' is an instance of XMLHttpRequest in the browser and an instance of
    http.ClientRequest in node.js`);
    console.log(error.request);
  } else if (error.config) {
    console.log(error.config);
    console.log(`Fatal error in create->axios.post: ${error}`);
  } else {
    console.log("Something happened in setting up the request that triggered an Error")
    console.log('Error', error.message);
  }

  //process.exit(1);
};


function zenodoMessage(number) {

  if (number === 200)
    console.log(`${number}: OK	Request succeeded. Response included. Usually sent for GET/PUT/PATCH requests`);
  else if (number === 201)
    console.log(`${number}: Created	Request succeeded. Response included. Usually sent for POST requests.`);
  else if (number === 202)
    console.log(`${number}: Accepted	Request succeeded. Response included. Usually sent for POST requests, where background processing is needed to fulfill the request.`);
  else if (number === 204)
    console.log(`${number}: No Content	Request succeeded. No response included. Usually sent for DELETE requests.`);
  else if (number === 400)
    console.log(`${number}: Bad Request	Request failed. Error response included.`);
  else if (number === 401)
    console.log(`${number}: Unauthorized	Request failed, due to an invalid access token. Error response included.`);
  else if (number === 403)
    console.log(`${number}: Forbidden	Request failed, due to missing authorization (e.g. deleting an already submitted upload or missing scopes for your access token). Error response included.`);
  else if (number === 404)
    console.log(`${number}: Not Found	Request failed, due to the resource not being found. Error response included.`);
  else if (number === 405)
    console.log(`${number}: Method Not Allowed	Request failed, due to unsupported HTTP method. Error response included.`);
  else if (number === 409)
    console.log(`${number}: Conflict	Request failed, due to the current state of the resource (e.g. edit a deopsition which is not fully integrated). Error response included.`);
  else if (number === 415)
    console.log(`${number}: Unsupported Media Type	Request failed, due to missing or invalid request header Content-Type. Error response included.`);
  else if (number === 429)
    console.log(`${number}: Too Many Requests	Request failed, due to rate limiting. Error response included.`);
  else
    console.log(`${number}: Internal Server Error	Request failed, due to an internal server error. Error response NOT included. Don’t worry, Zenodo admins have been notified and will be dealing with the problem ASAP.`);

}




/* OLD axios post code:
  const options = { headers: { 'Content-Type': "application/json" }, params: params }
  const resData = await axios.post(zenodoAPIUrl, JSON.stringify(payload), options)
  .then(res => {
  if (verbose) {
  console.log(res.status)
  zenodoMessage(res.status)
  console.log(res)
  }
  return res.data;
  }).catch(err => {
  axiosError(err)
  });

  /*
  option to zenodo-cli --verbose
  if (verbose) {
    console.log(zenodoMessage(res.status))
  }
  */

/*
The functions should be migrated in the following priority:
P1: list - done, get - done, show - done, dump - done, create - done, update - done, upload-done, publish(no)
P2: new version(no), download -tested by Zeina, concept - done, open-done
P3: duplicate-(no), multi-duplicate-(no)

*/
