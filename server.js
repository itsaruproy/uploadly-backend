const express = require('express')
const fs = require('fs')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { OAuth2Client } = require('google-auth-library')
const User = require('./models/User')
const Token = require('./models/Token')
const Link = require('./models/Link')
const busboy = require('busboy')
const jwt = require('jsonwebtoken')
const auth = require('./utils/auth')
const uniqueAlphaNumericId = require('./utils/generateLink')
app.use(cors())

const upload = require('./drive/upload')
app.use(express.json())
const path = require('path')
const jwtdecode = require('jwt-decode')

const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'postmessage'
)

app.get('/', (req, res) => {
    res.json({ message: 'API working correctly' })
})

app.post('/getToken', async (req, res) => {
    try {
        const { tokens } = await oAuth2Client.getToken(req.body.code)

        const userDetails = jwtdecode(tokens.id_token)
        console.log(userDetails)

        try {
            const userDoc = await User.findUserById(userDetails.sub)
            if (!userDoc) {
                let user = new User(userDetails.sub, userDetails.email)
                await user.save()

                let userToken = new Token(userDetails.sub, tokens.refresh_token)
                await userToken.save()
            } else {
                // Check refresh tokens date from Tokens collection and if necessary update it
            }
        } catch (err) {
            console.log(err)
        }

        // console.log(new Date(tokens.expiry_date))
        res.json({
            token: jwt.sign(
                {
                    gid: userDetails.sub,
                    email: userDetails.email,
                },
                process.env.JWTSECRET,
                {
                    expiresIn: '365d',
                }
            ),
        })
    } catch (err) {
        console.log(err)
        res.json({ message: 'Token expired try logging again' })
    }
    // Save this token into database with the users data inside of it from cookies
})

app.post('/link/create', auth, async (req, res) => {
    const { folderID, targetName } = req.body

    if (folderID && targetName) {
        try {
            let uniqueLinkString = uniqueAlphaNumericId()
            let link = new Link(req.apiUser.gid, uniqueLinkString, folderID)
            await link.save()
            res.json({ message: 'Link created successfully' })
        } catch (err) {
            res.sendStatus(500).json({ message: 'Link creation failed' })
        }
    } else {
        res.json({ message: 'Please provide appropriate information' })
    }
    // Folder id needed where it is going to upload
    // Get the name for which it is uploading
    // Get the gid from the user
    // generate a random number or string
    // Store the name, gid and random string into database and return it to the user also
})

app.post('/link/delete/:id', auth, async (req, res) => {
    /*
        1. First check if the link exists or check what mongodb returns if there is no document.
    */

    try {
        await Link.deleteLinkByID(req.params.id)
        res.json({ message: 'Link deleted successfully' })
    } catch (err) {
        res.json({ message: 'Failed to delete the link' })
    }
})

app.post('/link/get', auth, async (req, res) => {
    try {
        let links = await Link.getAllLinksByID(req.apiUser.gid) // Need to modify it before sending
        console.log(links)
        res.json({ links: links })
    } catch (err) {
        res.json({ message: 'Error retriving the links' })
    }
})

app.post('/upload/:id', async (req, res) => {
    /*
        1. find user token from the id
        2. if it has no link associated with it then send a response that invalid link
        3. otherwise pipe the request to busboy and upload that file to server
        4. on finish uploading use the upload function
    
    */
    try {
        const linkDoc = await Link.findLinkByID(req.params.id)
        const folderID = linkDoc.folderID
        const { refreshToken } = await Token.findTokenByUserID(linkDoc.gid)

        if (linkDoc && refreshToken) {
            const bb = busboy({ headers: req.headers })
            let fileName = ''
            let mimeType
            let fpath = ''
            bb.on('file', (_, file, info) => {
                fileName = info.filename
                mimeType = info.mimeType
                const pathText = `/uploads/${fileName}`
                fpath = path.join(__dirname, pathText)
                file.pipe(fs.createWriteStream(fpath, { flags: 'a+' }))
            })

            bb.on('finish', async () => {
                const resp = await upload(
                    fpath,
                    mimeType,
                    folderID,
                    refreshToken
                )
                res.json({ message: resp })
            })

            bb.on('error', () => {
                res.json({ message: 'File upload failed' })
            })

            req.pipe(bb)
        } else {
            res.json({ message: 'No token found' })
        }
    } catch (err) {
        console.log('file upload failed')
        res.json({ message: err })
    }
})

module.exports = app
