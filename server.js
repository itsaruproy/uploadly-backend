const express = require("express")
const app = express()
require("dotenv").config()
// const GoogleDrive = require("./drive")
const { OAuth2Client } = require("google-auth-library")
const User = require("./models/User")
const Token = require("./models/Token")
const upload = require("./drive/upload")
app.use(express.json())
const path = require("path")
const jwtdecode = require("jwt-decode")

const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'postmessage'
)




app.get("/", async (req, res) => {
    // const user = new GoogleDrive()
    // user.call((authClient) => {
    //     console.log("Printing auth client")
    //     console.log(authClient)
    //     res.json({url: authClient})
    // })
    const user = new User("arup", "roy")
    try {
        await user.save()
        res.json({ message: "User saved to database" })
    } catch {

        res.json({ message: "Problem saving user" })
    }
    
})


app.post("/getToken", async (req, res) => {
    try {

        const {tokens} = await oAuth2Client.getToken(req.body.code)

         const userDetails = jwtdecode(tokens.id_token)
         console.log(userDetails)

         try {
            const userDoc = await User.findUserById(userDetails.sub)
            if(!userDoc) {
                let user = new User(userDetails.sub, userDetails.email)
                await user.save()

                let userToken = new Token(userDetails.sub, tokens.refresh_token)
                await userToken.save()
            } else {
                // Check refresh tokens date from Tokens collection and if necessary update it
            }
         } catch(err) {
            console.log(err)
         }

        console.log(new Date(tokens.expiry_date))
        // const credentials = await oAuth2Client.refreshAccessToken(tokens.refresh_token)
        // console.log(credentials)
        // console.log("Printing OPENID details")
        //console.log({tokens})
    
        res.json({tokens: tokens})
    } catch(err) {
        console.log(err)
        res.json({message: "Token expired try logging again"})
    }
    // Save this token into database with the users data inside of it from cookies
})

app.post("/createLink", async (req, res) => {
    // Folder id needed where it is going to upload
    // Get the name for which it is uploading
    // Get the gid from the user
    // generate a random number or string
    // Store the name, gid and random string into database and return it to the user also
})

app.post("/upload/:id", async (req, res) => {
    /*
        1. find user token from the id
        2. if it has no link associated with it then send a response that invalid link
        3. otherwise pipe the request to busboy and upload that file to server
        4. on finish uploading use the upload function
    
    */


    try {
        const resp = await upload(path.join(__dirname, "reduxx.png"), "image/png", "1LSzKJVt8MK2c8vDHm2Ros3jTpbNkzHdF", process.env.REFRESH_TOKEN)
        // console.log(resp)
        res.json({message: resp})
    } catch(err) {
        console.log("file upload failed")
        res.json({message: err})
    }

})

module.exports = app
