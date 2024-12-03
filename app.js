const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve static files
app.use(express.static('public')) // Ensure `public` folder has your HTML and related files

// In-memory chat storage
const groups = {
  'Scholarship Help': { messages: [], messageId: 1 },
  'Hostel Help': { messages: [], messageId: 1 }
}


// Socket.IO connection
io.on('connection', socket => {
  console.log('A user connected')

  // When a user joins a group, store their admin status and group
  socket.on('joinGroup', ({ username, group, isAdmin }) => {
    // if (['Scholarship Help', 'Hostel Help'].includes(group)) return
    const chat = groups[group]

    // Add user to the group room
    socket.join(group)
    console.log(`${username} joined group: ${group}`)

    // Send chat history to the user
    socket.emit('chatHistory', chat.messages)

    // Broadcast to the group that a new user joined
    socket.to(group).emit('message', {
      id: chat.messageId++,
      username: 'System',
      message: `${username} has joined the chat.`,
      isPinned: false
    })

    // Store admin status in socket data
    socket.data.isAdmin = isAdmin
    socket.data.username = username
  })

  // Listen for new messages
  socket.on('sendMessage', ({ username, group, message }) => {
    // if (!['Scholarship Help', 'Hostel Help'].includes(group)) return
    const chat = groups[group]
    const messageObj = {
      id: chat.messageId++,
      username,
      message,
      isPinned: false
    }

    chat.messages.push(messageObj)
    io.to(group).emit('message', messageObj)
  })

  // Listen for message deletion
  socket.on('deleteMessage', ({ group, messageId }) => {
    // if (!['Scholarship Help', 'Hostel Help'].includes(group)) return
    const chat = groups[group]
    const message = chat.messages.find(msg => msg.id === messageId)

    // Check if the user is an admin or the sender of the message
    if (socket.data.isAdmin || message.username === socket.data.username) {
      // Remove the message from the group's history
      chat.messages = chat.messages.filter(msg => msg.id !== messageId)

      // Notify all users in the group
      io.to(group).emit('messageDeleted', messageId)
    } else {
      console.log('User does not have permission to delete this message')
    }
  })

  // Listen for message pinning (admin only)
  socket.on('pinMessage', ({ group, messageId }) => {
    if (!socket.data.isAdmin) {
      console.log('Only admins can pin messages')
      return
    }
    // if (!['Scholarship Help', 'Hostel Help'].includes(group)) return
    const chat = groups[group]

    // Find the message and mark it as pinned
    const message = chat.messages.find(msg => msg.id === messageId)
    if (message) {
      message.isPinned = true

      // Notify all users in the group
      io.to(group).emit('messagePinned', messageId)
    }
  })

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('A user disconnected')
  })
})

// Start the server
const PORT = process.env.PORT || 3300
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
