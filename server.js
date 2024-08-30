const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

let present = false;
// Initialize express app
const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const mongoDBUri = 'mongodb+srv://pj123:skibidi@cluster0.1uxmx.mongodb.net/yourDatabaseName'; // Replace 'yourDatabaseName'
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define a User schema with location and approval fields


// Admin credentials

// Define OffsiteRequest schema
const offsiteRequestSchema = new mongoose.Schema({
  username: { type: String, required: true },
  fromTime: { type: Date, required: true },
  leavingTime: { type: Date, required: true },
  location: { type: String, required: true },
  currentLocation: { lat: Number, lon: Number },
  submittedAt: { type: Date, default: Date.now },
  isApproved: { type: Boolean, default: null } // null = pending, true = approved, false = disapproved
});
const OffsiteRequest = mongoose.model('OffsiteRequest', offsiteRequestSchema);

// Define User schema with a reference to OffsiteRequest
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  attendance: { type: Number, default: 0 },
  punchInTime: String,
  punchOutTime: String,
  firstCheckInTime: String,
  lastCheckOutTime: String,
  totalWorkingHours: { type: Number, default: 0 },
  lastCheckInDate: String,
  isApproved: { type: Boolean, default: false },
  location: {
    lat: Number,
    lon: Number
  },
  department: String, // New field for department
  idNumber: String,   // New field for ID number
  position: String    // New field for position
});

const User = mongoose.model('User', userSchema);

// Admin credentials
const adminCredentials = {
  username: 'admin', // Replace with your desired admin username
  password: 'admin123' // Replace with your desired admin password
};
// Utility functions



const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// Admin Login endpoint
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === adminCredentials.username && password === adminCredentials.password) {
    res.json({ success: true, message: 'Admin login successful' });
  } else {
    res.json({ success: false, message: 'Invalid admin credentials' });
  }
});

// Admin Dashboard Data endpoint
app.get('/admin/dashboard', async (req, res) => {
  const { username } = req.query;

  if (username !== adminCredentials.username) {
    return res.json({ success: false, message: 'Unauthorized' });
  }

  try {
    const users = await User.find({});
    res.json({
      success: true,
      users: users.map(user => ({
        username: user.username,
        firstCheckInTime: user.firstCheckInTime,
        lastCheckOutTime: user.lastCheckOutTime,
        totalAttendance: user.attendance,
        totalWorkingHours: formatTime(user.totalWorkingHours),
        location: user.location ? `${user.location.lat}, ${user.location.lon}` : 'N/A' // Include location
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/admin/offsite-requests', async (req, res) => {
  try {
    // Fetch all offsite requests with corresponding user information
    const requests = await OffsiteRequest.find().populate('username');
    
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve or disapprove a request
app.post('/admin/approve-request', async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const offsiteRequest = await OffsiteRequest.findById(requestId);

    if (!offsiteRequest) {
      return res.status(404).json({ success: false, message: 'Offsite request not found' });
    }

    offsiteRequest.isApproved = true; // Approve the request
    await offsiteRequest.save();

    res.status(200).json({ success: true, message: 'Offsite request approved successfully' });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
});



// Sign In endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (user) {
      res.json({ success: true, message: 'Login successful', username: user.username });
    } else {
      res.json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Attendance update endpoint
app.post('/update-attendance', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user) {
      user.attendance += 1;
      await user.save();
      res.json({ success: true, message: 'Attendance updated', attendance: user.attendance });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Punch In endpoint
app.post('/punch-in', async (req, res) => {
  const { username } = req.body;
  
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Get the current time in UTC and convert to IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset);

    // Format the IST time
    const formattedDateTime = istTime.toISOString().replace('T', ' ').substring(0, 19);

    // Get today's date in ISO format adjusted for IST
    const todayDate = istTime.toISOString().split('T')[0];

    // Check if the user has already punched in today
    if (user.lastCheckInDate === todayDate) {
      return res.status(400).json({ success: false, message: 'Already punched in today' });
    }

    if (user.lastCheckInDate !== todayDate) {
      user.firstCheckInTime = formattedDateTime;
      user.lastCheckOutTime = null;
      user.lastCheckInDate = todayDate;
      user.attendance += 1; // Increment attendance only once per day
    }

    user.punchInTime = formattedDateTime;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Punched In successfully', 
      punchInTime: user.punchInTime,
      firstCheckInTime: user.firstCheckInTime 
    });

  } catch (error) {
    console.error('Error during punch-in:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post('/punch-out', async (req, res) => {
  const { username } = req.body;
  
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Get the current time in UTC and convert to IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset);

    // Format the IST time
    const formattedDateTime = istTime.toISOString().replace('T', ' ').substring(0, 19);

    // Check if the user has already punched out today


    user.punchOutTime = formattedDateTime;
    user.lastCheckOutTime = formattedDateTime;

    // Calculate total working hours
    const firstCheckInTime = new Date(user.firstCheckInTime);
    const lastCheckOutTime = new Date(user.lastCheckOutTime);

    // Calculate the difference in milliseconds and convert to hours
    const workingHours = (lastCheckOutTime - firstCheckInTime) / (1000 * 60 * 60);
    user.totalWorkingHours += workingHours;

    // Reset punchInTime to prevent multiple punch-outs
    user.punchInTime = null;

    await user.save();

    res.json({ 
      success: true, 
      message: 'Punched Out successfully', 
      punchOutTime: user.punchOutTime,
      totalWorkingHours: user.totalWorkingHours 
    });

  } catch (error) {
    console.error('Error during punch-out:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Route to get employee details by username
app.get('/employee-details/:username', async (req, res) => {
  try {
      const { username } = req.params;
      const employee = await User.findOne({ username });

      if (!employee) {
          return res.status(404).json({ message: 'Employee not found' });
      }

      // Send only the relevant employee details
      const employeeDetails = {
          idNumber: employee.idNumber,
          username: employee.username,
          department: employee.department,
          position: employee.position,
          attendance: employee.attendance,
      };

      res.status(200).json(employeeDetails);
  } catch (error) {
      res.status(500).json({ message: 'Server error', error });
  }
});


// Get Attendance endpoint
app.get('/get-attendance', async (req, res) => {
  const { username } = req.query;

  try {
    const user = await User.findOne({ username });
    if (user) {
      res.json({
        success: true,
        attendance: [{
          firstCheckInTime: user.firstCheckInTime,
          lastCheckOutTime: user.lastCheckOutTime,
          totalAttendance: user.attendance,
          totalWorkingHours: formatTime(user.totalWorkingHours)
        }],
      });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/offsite-request', async (req, res) => {
  try {
    const { fromTime, leavingTime, location, currentLocation, username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const offsiteRequest = new OffsiteRequest({
      username,
      fromTime,
      leavingTime,
      location,
      currentLocation
    });

    await offsiteRequest.save();
    res.status(200).json({ success: true, message: 'Offsite work request submitted successfully!' });
  } catch (error) {
    console.error('Error saving offsite request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit offsite request' });
  }
});

app.get('/check-approval-status', async (req, res) => {
  try {
    const username = req.query.username;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // Fetch the latest offsite request for the given username
    const latestRequest = await OffsiteRequest.findOne({ username }).sort({ submittedAt: -1 });

    if (!latestRequest) {
      return res.status(404).json({ success: false, message: 'No offsite request found' });
    }

    res.status(200).json({
      success: true,
      isApproved: latestRequest.isApproved,
      message: 'Request status fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching approval status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch approval status' });
  }
});

app.get('/attendance-data', async (req, res) => {
  const { username, month, year } = req.query;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Calculate the total days in the given month
    const totalDays = new Date(year, month, 0).getDate(); // month is 1-based

    // Get the attendance count for the month
    const attendanceCount = await User.countDocuments({
      username,
      lastCheckInDate: {
        $gte: `${year}-${month.padStart(2, '0')}-01`,
        $lte: `${year}-${month.padStart(2, '0')}-${totalDays}`
      }
    });

    res.json({
      success: true,
      data: {
        attendance: user.attendance,
        totalDays: totalDays
      }
    });

  } catch (error) {
    console.error('Error fetching attendance data:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});