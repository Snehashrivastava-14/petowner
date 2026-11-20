let currentUser = null;
let pets = [];
let appointments = [];
let prescriptions = [];
let medicalHistory = [];
let selectedAIProvider = null;
let availableModels = [];
let supabaseClient = null;

const API_CONFIG = {
    openai: {
        baseUrl: 'https://api.openai.com/v1',
        proxyUrl: window.location.origin + '/api/chat/openai',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        modelsEndpoint: '/models',
        apiKey: null,
        supportsCORS: false
    },
    nvidia: {
        baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
        proxyUrl: window.location.origin + '/api/chat/nvidia',
        models: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mixtral-8x7b-instruct'],
        modelsEndpoint: '/models',
        apiKey: null,
        supportsCORS: false
    },
    openrouter: {
        baseUrl: 'https://openrouter.ai/api/v1',
        proxyUrl: window.location.origin + '/api/chat/openrouter',
        models: ['anthropic/claude-3-opus', 'openai/gpt-4-turbo', 'google/gemini-pro'],
        modelsEndpoint: '/models',
        apiKey: null,
        supportsCORS: true
    }
};

let useProxy = false;

async function checkProxyServer() {
    try {
        const response = await fetch(window.location.origin);
        useProxy = true;
    } catch (error) {
        useProxy = false;
    }
}

function loadAPIKeys() {
    try {
        if (typeof API_KEYS !== 'undefined') {
            API_CONFIG.openai.apiKey = API_KEYS.openai;
            API_CONFIG.nvidia.apiKey = API_KEYS.nvidia;
            API_CONFIG.openrouter.apiKey = API_KEYS.openrouter;
        }
    } catch (error) {
    }
}

const MODEL_RECOMMENDATIONS = {
    openai: {
        recommended: 'gpt-4-turbo',
        reason: 'Best balance of performance and cost for pet care advice'
    },
    nvidia: {
        recommended: 'meta/llama-3.3-70b-instruct',
        reason: 'High-quality open-source model with good reasoning capabilities'
    },
    openrouter: {
        recommended: 'anthropic/claude-3-opus',
        reason: 'Excellent for detailed, nuanced pet care guidance'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App initializing...');

    // Check for Supabase configuration
    if (typeof window.supabase === 'undefined' ||
        typeof SUPABASE_URL === 'undefined' ||
        typeof SUPABASE_ANON_KEY === 'undefined' ||
        SUPABASE_URL === 'YOUR_SUPABASE_URL' ||
        SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('❌ Supabase not configured');
        alert('Error: Supabase not configured. Please run node setup-env.js with your Supabase credentials in .env');
        return;
    }

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');

        // Check for existing session
        checkSupabaseSession();

        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('🔄 Auth state change:', event, session ? 'User logged in' : 'User logged out');
            if (event === 'SIGNED_IN') {
                handleSupabaseLogin(session);
            } else if (event === 'SIGNED_OUT') {
                handleSupabaseLogout();
            }
        });
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        alert('Error initializing Supabase. Check console for details.');
        return;
    }

    loadAPIKeys();
    checkProxyServer();
    setupEventListeners();
    console.log('✅ App initialization complete');
});

async function loadUserDataFromSupabase() {
    try {
        // Load pets
        const { data: petsData, error: petsError } = await supabaseClient
            .from('pets')
            .select('*')
            .eq('user_id', currentUser.id);

        if (!petsError && petsData) {
            pets = petsData;
        }

        // Load appointments with pet information
        const { data: appointmentsData, error: appointmentsError } = await supabaseClient
            .from('appointments')
            .select('*, pets(name)')
            .eq('user_id', currentUser.id);

        if (!appointmentsError && appointmentsData) {
            appointments = appointmentsData;
        }

        // Load prescriptions with pet information
        const { data: prescriptionsData, error: prescriptionsError } = await supabaseClient
            .from('prescriptions')
            .select('*, pets(name)')
            .eq('user_id', currentUser.id);

        if (!prescriptionsError && prescriptionsData) {
            prescriptions = prescriptionsData;
        }

        // Load medical history with pet information
        const { data: historyData, error: historyError } = await supabaseClient
            .from('medical_history')
            .select('*, pets(name)')
            .eq('user_id', currentUser.id);

        if (!historyError && historyData) {
            medicalHistory = historyData;
        }

        updateDashboard();
    } catch (error) {
        console.error('Error loading data from Supabase:', error);
    }
}



// Supabase CRUD Operations
async function addPetToSupabase(pet) {
    try {
        const { data, error } = await supabaseClient
            .from('pets')
            .insert([{
                user_id: currentUser.id,
                name: pet.name,
                species: pet.species,
                breed: pet.breed,
                age: pet.age,
                weight: pet.weight,
                gender: pet.gender
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding pet:', error);
        throw error;
    }
}

async function deletePetFromSupabase(petId) {
    try {
        const { error } = await supabaseClient
            .from('pets')
            .delete()
            .eq('id', petId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting pet:', error);
        throw error;
    }
}

async function addAppointmentToSupabase(appointment) {
    try {
        const { data, error } = await supabaseClient
            .from('appointments')
            .insert([{
                user_id: currentUser.id,
                pet_id: appointment.petId,
                date: appointment.date,
                time: appointment.time,
                type: appointment.type,
                notes: appointment.notes,
                status: appointment.status
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding appointment:', error);
        throw error;
    }
}

async function updateAppointmentInSupabase(appointmentId, status) {
    try {
        const { data, error } = await supabaseClient
            .from('appointments')
            .update({ status: status })
            .eq('id', appointmentId)
            .eq('user_id', currentUser.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating appointment:', error);
        throw error;
    }
}

async function addPrescriptionToSupabase(prescription) {
    try {
        const { data, error } = await supabaseClient
            .from('prescriptions')
            .insert([{
                user_id: currentUser.id,
                pet_id: prescription.petId,
                medication: prescription.medication,
                dosage: prescription.dosage,
                frequency: prescription.frequency,
                vet: prescription.vet,
                instructions: prescription.instructions,
                status: prescription.status
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding prescription:', error);
        throw error;
    }
}

async function deletePrescriptionFromSupabase(prescriptionId) {
    try {
        const { error } = await supabaseClient
            .from('prescriptions')
            .delete()
            .eq('id', prescriptionId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting prescription:', error);
        throw error;
    }
}

async function addMedicalHistoryToSupabase(history) {
    try {
        const { data, error } = await supabaseClient
            .from('medical_history')
            .insert([{
                user_id: currentUser.id,
                pet_id: history.petId,
                type: history.type,
                title: history.title,
                date: history.date,
                notes: history.notes
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding medical history:', error);
        throw error;
    }
}

function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('add-pet-form').addEventListener('submit', handleAddPet);
    document.getElementById('book-appointment-form').addEventListener('submit', handleBookAppointment);
    document.getElementById('add-prescription-form').addEventListener('submit', handleAddPrescription);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showDashboardPage(pageId) {
    document.querySelectorAll('.dashboard-page').forEach(page => page.classList.remove('active'));

    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('onclick')?.includes(`'${pageId}'`)) {
            link.classList.add('active');
        }
    });
}

function showDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.getElementById('user-name').textContent = currentUser.name;
    updateDashboard();
    showDashboardPage('dashboard');
}

function logout() {
    supabaseClient.auth.signOut();
}

// Supabase Authentication Functions
async function checkSupabaseSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            handleSupabaseLogin(session);
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

async function handleSupabaseLoginAuth(email, password) {
    try {
        console.log('Attempting Supabase login for:', email);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('Supabase login error:', error);
            alert('Login failed: ' + error.message);
            return;
        }

        console.log('✅ Supabase login successful:', data);
        // Auth state change listener will handle the rest
    } catch (error) {
        console.error('Login exception:', error);
        alert('Login failed: ' + error.message);
    }
}

async function handleSupabaseSignup(email, password, name, phone) {
    try {
        console.log('Attempting Supabase signup for:', email);
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name,
                    phone: phone
                }
            }
        });

        if (error) {
            console.error('Supabase signup error:', error);
            alert('Signup failed: ' + error.message);
            return;
        }

        console.log('✅ Supabase signup response:', data);

        if (data.user) {
            if (data.session) {
                alert('Account created successfully! You are now logged in.');
            } else {
                alert('Account created successfully! Please check your email to verify your account.');
            }
            // Auth state change listener will handle the rest if email verification is disabled
        }
    } catch (error) {
        console.error('Signup exception:', error);
        alert('Signup failed: ' + error.message);
    }
}

async function handleSupabaseLogin(session) {
    try {
        // Get user profile
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            // Fallback to user metadata
            currentUser = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || 'User',
                phone: session.user.user_metadata?.phone || ''
            };
        } else {
            currentUser = {
                id: profile.id,
                email: profile.email,
                name: profile.full_name,
                phone: profile.phone
            };
        }

        // Load user's data from Supabase
        await loadUserDataFromSupabase();

        showDashboard();
    } catch (error) {
        console.error('Error handling login:', error);
    }
}

function handleSupabaseLogout() {
    currentUser = null;
    pets = [];
    appointments = [];
    prescriptions = [];
    medicalHistory = [];
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    showPage('login-page');
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[0-9]{10,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email) {
        alert('Please enter your email');
        return;
    }
    if (!isValidEmail(email)) {
        alert('Please enter a valid email address');
        return;
    }
    if (!password) {
        alert('Please enter your password');
        return;
    }
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    handleSupabaseLoginAuth(email, password);
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!name) {
        alert('Please enter your full name');
        return;
    }
    if (name.length < 2) {
        alert('Name must be at least 2 characters');
        return;
    }
    if (!email) {
        alert('Please enter your email');
        return;
    }
    if (!isValidEmail(email)) {
        alert('Please enter a valid email address');
        return;
    }
    if (!phone) {
        alert('Please enter your phone number');
        return;
    }
    if (!isValidPhone(phone)) {
        alert('Please enter a valid phone number (10-15 digits)');
        return;
    }
    if (!password) {
        alert('Please enter a password');
        return;
    }
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    if (password !== confirm) {
        alert('Passwords do not match');
        return;
    }

    handleSupabaseSignup(email, password, name, phone);
}

function updateDashboard() {
    document.getElementById('total-pets').textContent = pets.length;

    const upcoming = appointments.filter(a => new Date(a.date) >= new Date()).length;
    document.getElementById('upcoming-appointments').textContent = upcoming;

    document.getElementById('active-prescriptions').textContent = prescriptions.length;
    document.getElementById('total-visits').textContent = medicalHistory.length;

    renderPets();
    renderAppointments();
    renderPrescriptions();
    renderHistory();
    renderRecentActivity();
}

function renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    const activities = [];

    appointments.forEach(a => {
        activities.push({
            type: 'appointment',
            date: a.date,
            text: `Appointment for ${getPetName(a.pet_id, a)} - ${a.type}`,
            icon: 'fa-calendar',
            color: 'blue'
        });
    });

    prescriptions.forEach(p => {
        activities.push({
            type: 'prescription',
            date: p.date,
            text: `Prescription for ${getPetName(p.pet_id, p)} - ${p.medication}`,
            icon: 'fa-pills',
            color: 'purple'
        });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (activities.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No recent activity</p>';
        return;
    }

    container.innerHTML = activities.slice(0, 5).map(a => `
        <div class="flex items-center space-x-4 p-4 bg-white/50 rounded-xl backdrop-blur">
            <div class="icon-circle w-12 h-12 rounded-full flex items-center justify-center">
                <i class="fas ${a.icon} text-white"></i>
            </div>
            <div class="flex-1">
                <p class="text-gray-800 font-medium">${a.text}</p>
                <p class="text-gray-500 text-sm">${new Date(a.date).toLocaleDateString()}</p>
            </div>
        </div>
    `).join('');
}

function openAddPetModal() {
    document.getElementById('add-pet-modal').classList.remove('hidden');
    document.getElementById('add-pet-modal').classList.add('flex');
}

function closeAddPetModal() {
    document.getElementById('add-pet-modal').classList.add('hidden');
    document.getElementById('add-pet-modal').classList.remove('flex');
    document.getElementById('add-pet-form').reset();
}

async function handleAddPet(e) {
    e.preventDefault();
    const name = document.getElementById('pet-name').value.trim();
    const species = document.getElementById('pet-species').value;
    const breed = document.getElementById('pet-breed').value.trim();
    const age = document.getElementById('pet-age').value.trim();
    const weight = document.getElementById('pet-weight').value;
    const gender = document.getElementById('pet-gender').value;

    if (!name) {
        alert('Please enter pet name');
        return;
    }
    if (name.length < 2) {
        alert('Pet name must be at least 2 characters');
        return;
    }
    if (!species) {
        alert('Please select species');
        return;
    }
    if (!gender) {
        alert('Please select gender');
        return;
    }
    if (weight && (parseFloat(weight) <= 0 || parseFloat(weight) > 200)) {
        alert('Please enter a valid weight (0-200 kg)');
        return;
    }

    const pet = {
        name,
        species,
        breed,
        age,
        weight,
        gender
    };

    try {
        const newPet = await addPetToSupabase(pet);
        pets.push(newPet);
        updateDashboard();
        closeAddPetModal();
    } catch (error) {
        alert('Failed to add pet: ' + error.message);
    }
}

function renderPets() {
    const container = document.getElementById('pets-list');
    const appointmentPetSelect = document.getElementById('appointment-pet');
    const prescriptionPetSelect = document.getElementById('prescription-pet');

    if (pets.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">No pets added yet</p>';
        if (appointmentPetSelect) appointmentPetSelect.innerHTML = '<option value="">Select a pet</option>';
        if (prescriptionPetSelect) prescriptionPetSelect.innerHTML = '<option value="">Select a pet</option>';
        return;
    }

    const speciesIcons = {
        dog: 'fa-dog',
        cat: 'fa-cat',
        bird: 'fa-dove',
        rabbit: 'fa-carrot',
        other: 'fa-paw'
    };

    container.innerHTML = pets.map(pet => `
        <div class="pet-card p-6 rounded-2xl shadow-lg">
            <div class="flex items-center space-x-4 mb-4">
                <div class="icon-circle w-16 h-16 rounded-full flex items-center justify-center">
                    <i class="fas ${speciesIcons[pet.species] || 'fa-paw'} text-white text-2xl"></i>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${pet.name}</h3>
                    <p class="text-gray-500 capitalize">${pet.species} - ${pet.breed || 'Mixed Breed'}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-gray-500">Age</p>
                    <p class="font-medium text-gray-800">${pet.age || 'Not specified'}</p>
                </div>
                <div>
                    <p class="text-gray-500">Weight</p>
                    <p class="font-medium text-gray-800">${pet.weight ? pet.weight + ' kg' : 'Not specified'}</p>
                </div>
                <div>
                    <p class="text-gray-500">Gender</p>
                    <p class="font-medium text-gray-800 capitalize">${pet.gender}</p>
                </div>
            </div>
            <div class="mt-4 flex space-x-2">
                <button onclick="deletePet('${pet.id}')" class="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');

    const petOptions = '<option value="">Select a pet</option>' +
        pets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    if (appointmentPetSelect) {
        appointmentPetSelect.innerHTML = petOptions;
    }
    if (prescriptionPetSelect) {
        prescriptionPetSelect.innerHTML = petOptions;
    }
}

async function deletePet(id) {
    if (confirm('Are you sure you want to delete this pet?')) {
        try {
            await deletePetFromSupabase(id);
            pets = pets.filter(p => p.id !== id);
            updateDashboard();
        } catch (error) {
            alert('Failed to delete pet: ' + error.message);
        }
    }
}

function getPetName(id, appointment = null) {
    // First check if appointment has pet name from the join
    if (appointment && appointment.pets && appointment.pets.name) {
        return appointment.pets.name;
    }
    // Fallback to finding in local pets array
    const pet = pets.find(p => p.id === id || p.id == id);
    return pet ? pet.name : 'Unknown Pet';
}

function openBookAppointmentModal() {
    document.getElementById('book-appointment-modal').classList.remove('hidden');
    document.getElementById('book-appointment-modal').classList.add('flex');
    renderPets();
}

function closeBookAppointmentModal() {
    document.getElementById('book-appointment-modal').classList.add('hidden');
    document.getElementById('book-appointment-modal').classList.remove('flex');
    document.getElementById('book-appointment-form').reset();
}

async function handleBookAppointment(e) {
    e.preventDefault();
    const petId = document.getElementById('appointment-pet').value;
    const date = document.getElementById('appointment-date').value;
    const time = document.getElementById('appointment-time').value;
    const type = document.getElementById('appointment-type').value;
    const notes = document.getElementById('appointment-notes').value.trim();

    if (!petId) {
        alert('Please select a pet');
        return;
    }
    if (!date) {
        alert('Please select appointment date');
        return;
    }
    const appointmentDate = new Date(date);
    if (appointmentDate < new Date().setHours(0,0,0,0)) {
        alert('Appointment date cannot be in the past');
        return;
    }
    if (!time) {
        alert('Please select appointment time');
        return;
    }
    if (!type) {
        alert('Please select appointment type');
        return;
    }

    const appointment = {
        petId: petId,
        date,
        time,
        type,
        notes,
        status: 'scheduled'
    };

    try {
        const newAppointment = await addAppointmentToSupabase(appointment);
        appointments.push(newAppointment);

        // Add to medical history
        await addMedicalHistoryToSupabase({
            petId: petId,
            type: 'appointment',
            title: `${type} appointment`,
            date: new Date().toISOString(),
            notes: notes
        });

        updateDashboard();
        closeBookAppointmentModal();
    } catch (error) {
        alert('Failed to book appointment: ' + error.message);
    }
}

function renderAppointments() {
    const container = document.getElementById('appointments-list');

    if (appointments.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No appointments scheduled</p>';
        return;
    }

    const sortedAppointments = [...appointments].sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = sortedAppointments.map(a => {
        const isPast = new Date(a.date) < new Date();
        const isCancelled = a.status === 'cancelled';
        const isDone = isPast && !isCancelled;

        let statusBadge = '';
        if (isCancelled) {
            statusBadge = '<span class="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm">Cancelled</span>';
        } else if (isDone) {
            statusBadge = '<span class="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm">Done</span>';
        } else {
            statusBadge = '<span class="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">Scheduled</span>';
        }

        const statusColor = isCancelled ? 'red' : (isDone ? 'green' : 'blue');

        return `
            <div class="bg-white p-6 rounded-xl shadow-md">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="bg-${statusColor}-100 p-4 rounded-full">
                            <i class="fas fa-calendar-check text-${statusColor}-500 text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${getPetName(a.pet_id, a)}</h3>
                            <p class="text-gray-500 capitalize">${a.type}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-800 font-medium">${new Date(a.date).toLocaleDateString()}</p>
                        <p class="text-gray-500">${a.time}</p>
                    </div>
                </div>
                ${a.notes ? `<p class="mt-4 text-gray-600 bg-gray-50 p-3 rounded-lg">${a.notes}</p>` : ''}
                <div class="mt-4 flex justify-between items-center">
                    ${statusBadge}
                    ${!isPast && !isCancelled ? `
                        <button onclick="cancelAppointment('${a.id}')" class="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function cancelAppointment(id) {
    if (confirm('Are you sure you want to cancel this appointment?')) {
        try {
            await updateAppointmentInSupabase(id, 'cancelled');
            // Reload appointments from Supabase to get updated data
            const { data: appointmentsData, error: appointmentsError } = await supabaseClient
                .from('appointments')
                .select('*, pets(name)')
                .eq('user_id', currentUser.id);

            if (!appointmentsError && appointmentsData) {
                appointments = appointmentsData;
            }
            updateDashboard();
        } catch (error) {
            alert('Failed to cancel appointment: ' + error.message);
        }
    }
}

function openAddPrescriptionModal() {
    document.getElementById('add-prescription-modal').classList.remove('hidden');
    document.getElementById('add-prescription-modal').classList.add('flex');
    renderPets();
}

function closeAddPrescriptionModal() {
    document.getElementById('add-prescription-modal').classList.add('hidden');
    document.getElementById('add-prescription-modal').classList.remove('flex');
    document.getElementById('add-prescription-form').reset();
}

async function handleAddPrescription(e) {
    e.preventDefault();
    const petId = document.getElementById('prescription-pet').value;
    const medication = document.getElementById('prescription-medication').value.trim();
    const dosage = document.getElementById('prescription-dosage').value.trim();
    const frequency = document.getElementById('prescription-frequency').value.trim();
    const vet = document.getElementById('prescription-vet').value.trim();
    const instructions = document.getElementById('prescription-instructions').value.trim();

    if (!petId) {
        alert('Please select a pet');
        return;
    }
    if (!medication) {
        alert('Please enter medication name');
        return;
    }
    if (medication.length < 2) {
        alert('Medication name must be at least 2 characters');
        return;
    }
    if (!dosage) {
        alert('Please enter dosage');
        return;
    }
    if (!frequency) {
        alert('Please enter frequency');
        return;
    }

    const prescription = {
        petId: petId,
        medication,
        dosage,
        frequency,
        vet: vet || 'Dr. Smith',
        instructions,
        status: 'active'
    };

    try {
        const newPrescription = await addPrescriptionToSupabase(prescription);
        prescriptions.push(newPrescription);

        // Add to medical history
        await addMedicalHistoryToSupabase({
            petId: petId,
            type: 'prescription',
            title: `Prescription: ${medication}`,
            date: new Date().toISOString(),
            notes: `Dosage: ${dosage}, Frequency: ${frequency}`
        });

        updateDashboard();
        closeAddPrescriptionModal();
    } catch (error) {
        alert('Failed to add prescription: ' + error.message);
    }
}

function renderPrescriptions() {
    const container = document.getElementById('prescriptions-list');
    const petSelect = document.getElementById('prescription-pet');

    if (petSelect && pets.length > 0) {
        petSelect.innerHTML = '<option value="">Select a pet</option>' +
            pets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    if (prescriptions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No prescriptions available</p>';
        return;
    }

    container.innerHTML = prescriptions.map(p => `
        <div class="bg-white p-6 rounded-xl shadow-md">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-4">
                    <div class="bg-purple-100 p-4 rounded-full">
                        <i class="fas fa-pills text-purple-500 text-xl"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${p.medication}</h3>
                        <p class="text-gray-500">${getPetName(p.pet_id, p)}</p>
                    </div>
                </div>
                <span class="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm">Active</span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-gray-500">Dosage</p>
                    <p class="font-medium text-gray-800">${p.dosage}</p>
                </div>
                <div>
                    <p class="text-gray-500">Frequency</p>
                    <p class="font-medium text-gray-800">${p.frequency}</p>
                </div>
                <div>
                    <p class="text-gray-500">Prescribed</p>
                    <p class="font-medium text-gray-800">${new Date(p.date).toLocaleDateString()}</p>
                </div>
                <div>
                    <p class="text-gray-500">Prescriber</p>
                    <p class="font-medium text-gray-800">${p.vet || 'Dr. Smith'}</p>
                </div>
            </div>
            ${p.instructions ? `<p class="mt-4 text-gray-600 bg-gray-50 p-3 rounded-lg"><strong>Instructions:</strong> ${p.instructions}</p>` : ''}
            <div class="mt-4 flex space-x-2">
                <button onclick="deletePrescription('${p.id}')" class="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function deletePrescription(id) {
    if (confirm('Are you sure you want to delete this prescription?')) {
        try {
            await deletePrescriptionFromSupabase(id);
            prescriptions = prescriptions.filter(p => p.id !== id);
            updateDashboard();
        } catch (error) {
            alert('Failed to delete prescription: ' + error.message);
        }
    }
}

function renderHistory() {
    const container = document.getElementById('history-list');

    if (medicalHistory.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No medical history available</p>';
        return;
    }

    const sortedHistory = [...medicalHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sortedHistory.map(h => `
        <div class="bg-white p-6 rounded-xl shadow-md">
            <div class="flex items-center space-x-4 mb-4">
                <div class="bg-orange-100 p-4 rounded-full">
                    <i class="fas fa-stethoscope text-orange-500 text-xl"></i>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${h.title}</h3>
                    <p class="text-gray-500">${getPetName(h.pet_id, h)}</p>
                </div>
                <div class="ml-auto text-right">
                    <p class="text-gray-800 font-medium">${new Date(h.date).toLocaleDateString()}</p>
                    <p class="text-gray-500 text-sm capitalize">${h.type}</p>
                </div>
            </div>
            ${h.notes ? `<p class="text-gray-600 bg-gray-50 p-3 rounded-lg">${h.notes}</p>` : ''}
        </div>
    `).join('');
}

function selectAIProvider(provider) {
    selectedAIProvider = provider;

    document.querySelectorAll('.ai-provider-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'bg-blue-50');
    });

    document.querySelector(`[data-provider="${provider}"]`).classList.add('border-blue-500', 'bg-blue-50');

    document.getElementById('model-selection').classList.remove('hidden');
    loadModels(provider);
}

async function loadModels(provider) {
    const config = API_CONFIG[provider];
    const select = document.getElementById('ai-model-select');

    select.innerHTML = '<option value="">Loading models...</option>';

    // Remove any existing recommendation divs
    const existingRecommendations = select.parentElement.querySelectorAll('.model-recommendation');
    existingRecommendations.forEach(div => div.remove());

    try {
        if (!config.apiKey || config.apiKey.startsWith('YOUR_')) {
            availableModels = config.models;
            select.innerHTML = '<option value="">Select a model...</option>' +
                availableModels.map(model => `<option value="${model}">${model}</option>`).join('');
            return;
        }

        const response = await fetch(config.baseUrl + config.modelsEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (provider === 'openai') {
                availableModels = data.data.map(m => m.id);
            } else if (provider === 'openrouter') {
                availableModels = data.data.map(m => m.id);
            } else if (provider === 'nvidia') {
                availableModels = config.models;
            }
        } else {
            availableModels = config.models;
        }

        const recommended = MODEL_RECOMMENDATIONS[provider]?.recommended;
        if (recommended && availableModels.includes(recommended)) {
            availableModels = [recommended, ...availableModels.filter(m => m !== recommended)];
        }

        select.innerHTML = '<option value="">Select a model...</option>' +
            availableModels.map(model => {
                const isRecommended = model === recommended;
                const label = isRecommended ? `${model} (Recommended)` : model;
                return `<option value="${model}">${label}</option>`;
            }).join('');

        if (recommended) {
            const recommendation = MODEL_RECOMMENDATIONS[provider];
            const recommendationDiv = document.createElement('div');
            recommendationDiv.className = 'mt-2 text-sm text-green-600 bg-green-50 p-2 rounded model-recommendation';
            recommendationDiv.innerHTML = `<i class="fas fa-star"></i> Recommended: ${recommended} - ${recommendation.reason}`;
            select.parentElement.appendChild(recommendationDiv);
        }

    } catch (error) {
        availableModels = config.models;
        select.innerHTML = '<option value="">Select a model...</option>' +
            availableModels.map(model => `<option value="${model}">${model}</option>`).join('');
    }
}

async function refreshModels() {
    if (selectedAIProvider) {
        const select = document.getElementById('ai-model-select');
        const existingRecommendation = select.parentElement.querySelector('.bg-green-50');
        if (existingRecommendation) {
            existingRecommendation.remove();
        }
        await loadModels(selectedAIProvider);
    }
}

async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();

    if (!message) return;

    const model = document.getElementById('ai-model-select').value;

    if (!selectedAIProvider) {
        alert('Please select an AI provider first');
        return;
    }

    if (!model) {
        alert('Please select a model first');
        return;
    }

    addChatMessage(message, 'user');
    input.value = '';

    const loadingId = addChatMessage('Thinking...', 'ai', true);

    try {
        const response = await callAI(selectedAIProvider, model, message);
        removeChatMessage(loadingId);
        addChatMessage(response, 'ai');
    } catch (error) {
        removeChatMessage(loadingId);
        let errorMessage;

        if (error.message.includes('API key not configured')) {
            errorMessage = `${error.message}. Please check the README.md for setup instructions.`;
        } else if (error.message.includes('API error')) {
            errorMessage = `API Error: ${error.message}. Please check your API key and try again.`;
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error: Could not connect to the API. Please check your internet connection.';
        } else {
            errorMessage = `Error: ${error.message}. Please try again or check your API key configuration.`;
        }

        addChatMessage(errorMessage, 'ai');
    }
}

function addChatMessage(text, sender, isLoading = false) {
    const container = document.getElementById('chat-messages');
    const id = 'msg-' + Date.now();

    const html = sender === 'user' ? `
        <div id="${id}" class="flex items-start space-x-3 justify-end">
            <div class="chat-bubble-user text-white p-4 max-w-md">
                <p>${text}</p>
            </div>
            <div class="icon-circle w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-user text-white"></i>
            </div>
        </div>
    ` : `
        <div id="${id}" class="flex items-start space-x-3">
            <div class="icon-circle w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-robot text-white"></i>
            </div>
            <div class="chat-bubble-ai p-4 max-w-md">
                <p class="text-gray-800">${isLoading ? '<i class="fas fa-spinner fa-spin"></i> ' : ''}${text}</p>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;

    return id;
}

function removeChatMessage(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}

async function callAI(provider, model, message) {
    const config = API_CONFIG[provider];

    if (!config.apiKey || config.apiKey.startsWith('YOUR_')) {
        throw new Error(`API key not configured for ${provider}. Please configure your API key in app.js or config.js`);
    }

    // Build context from pet data
    let petContext = '';
    if (pets && pets.length > 0) {
        petContext = '\n\nUser\'s Pets:\n';
        pets.forEach(pet => {
            petContext += `- ${pet.name} (${pet.species}, ${pet.gender})`;
            if (pet.breed) petContext += `, Breed: ${pet.breed}`;
            if (pet.age) petContext += `, Age: ${pet.age}`;
            if (pet.weight) petContext += `, Weight: ${pet.weight}kg`;
            petContext += '\n';

            // Add upcoming appointments for this pet
            const petAppointments = appointments.filter(a => a.pet_id === pet.id && new Date(a.date) >= new Date());
            if (petAppointments.length > 0) {
                petContext += `  Upcoming Appointments: ${petAppointments.map(a => `${a.type} on ${new Date(a.date).toLocaleDateString()} at ${a.time}`).join(', ')}\n`;
            }

            // Add active prescriptions for this pet
            const petPrescriptions = prescriptions.filter(p => p.pet_id === pet.id && p.status === 'active');
            if (petPrescriptions.length > 0) {
                petContext += `  Current Medications: ${petPrescriptions.map(p => `${p.medication} (${p.dosage}, ${p.frequency})`).join(', ')}\n`;
            }

            // Add recent medical history for this pet
            const petHistory = medicalHistory.filter(h => h.pet_id === pet.id).slice(-3);
            if (petHistory.length > 0) {
                petContext += `  Recent Medical History: ${petHistory.map(h => `${h.title} on ${new Date(h.date).toLocaleDateString()}`).join(', ')}\n`;
            }
        });
    }

    const systemPrompt = `You are a helpful AI pet care assistant for a pet owner dashboard. Provide accurate, helpful advice about pet health, nutrition, behavior, and general care based on the user's specific pets and their information.${petContext}

Always consider the specific pets mentioned above when providing advice. Reference the pet by name when giving pet-specific recommendations.
Always recommend consulting a veterinarian for serious health concerns or before making changes to medications.`;

    try {
        let url, headers, body;

        if (useProxy && !config.supportsCORS) {
            url = config.proxyUrl;
            headers = {
                'Content-Type': 'application/json'
            };
            body = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            };
        } else {
            url = config.baseUrl;
            if (!config.baseUrl.includes('/chat/completions')) {
                url = config.baseUrl + '/chat/completions';
            }
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Pet Owner Dashboard'
            };
            body = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 1000
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            return data.choices[0].message?.content || data.choices[0].text;
        } else if (data.message) {
            return data.message;
        } else {
            throw new Error('Unexpected response format from API');
        }
    } catch (error) {
        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            if (!config.supportsCORS && !useProxy) {
                throw new Error(`CORS error: ${provider} doesn't support direct browser calls. Please run the proxy server (npm run proxy) or use OpenRouter instead.`);
            }
        }

        throw error;
    }
}

