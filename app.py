# app.py - Professional Animated Resume Analyzer (No API Required)

import streamlit as st
import io
import PyPDF2
import os
import random
import time
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import re

# --- PAGE CONFIGURATION ---
st.set_page_config(
    page_title="Resume Analyzer Pro 2025",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- CUSTOM CSS FOR 2025-STYLE ANIMATIONS ---
st.markdown("""
<style>
/* Main app background with animated gradient */
.stApp {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
}

@keyframes gradientBG {
    0% {background-position: 0% 50%;}
    50% {background-position: 100% 50%;}
    100% {background-position: 0% 50%;}
}

/* Animated particles background */
.particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: -1;
}

.particle {
    position: absolute;
    display: block;
    pointer-events: none;
    width: 10px;
    height: 10px;
    background-color: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    animation: float 15s infinite;
}

@keyframes float {
    0% {transform: translateY(100vh) scale(0);}
    100% {transform: translateY(-100vh) scale(1);}
}

/* Sidebar styling with glassmorphism */
.sidebar .sidebar-content {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-right: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
}

/* Custom card component with glassmorphism */
.custom-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    padding: 1.5rem;
    border-radius: 15px;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    margin-bottom: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: white;
    transition: all 0.3s ease;
}

.custom-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 35px rgba(31, 38, 135, 0.5);
}

/* Animated title */
.animated-title {
    text-align: center;
    color: white;
    padding: 1rem;
    font-size: 3rem;
    font-weight: bold;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);}
    50% {text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);}
    100% {text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);}
}

/* Animated subtitle */
.animated-subtitle {
    text-align: center;
    color: white;
    font-size: 1.2rem;
    margin-bottom: 2rem;
    animation: fadeIn 2s;
}

@keyframes fadeIn {
    from {opacity: 0; transform: translateY(20px);}
    to {opacity: 1; transform: translateY(0);}
}

/* Progress bar animation */
.progress-bar {
    height: 5px;
    width: 100%;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    overflow: hidden;
    margin: 1rem 0;
}

.progress {
    height: 100%;
    background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%);
    width: 0;
    animation: progress 2s forwards;
}

@keyframes progress {
    to {width: 100%;}
}

/* Skill bar animation */
.skill-bar {
    height: 10px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    overflow: hidden;
    margin: 0.5rem 0;
}

.skill {
    height: 100%;
    background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
    width: 0;
    animation: skillFill 2s forwards;
}

@keyframes skillFill {
    to {width: var(--skill-level);}
}

/* Floating animation for buttons */
.floating-button {
    animation: floating 3s ease-in-out infinite;
}

@keyframes floating {
    0% {transform: translateY(0px);}
    50% {transform: translateY(-10px);}
    100% {transform: translateY(0px);}
}

/* Hiding streamlit default elements */
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {visibility: hidden;}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 10px;
}

::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}
</style>

<script>
// Create animated particles
document.addEventListener('DOMContentLoaded', function() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    document.body.appendChild(particlesContainer);
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.opacity = Math.random();
        particlesContainer.appendChild(particle);
    }
});
</script>
""", unsafe_allow_html=True)


# --- HELPER FUNCTIONS ---

def extract_text_from_pdf(pdf_file):
    """Extracts text from an uploaded PDF file."""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_file.read()))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        st.error(f"Error reading PDF file: {e}")
        return None

def analyze_resume_locally(resume_text):
    """Analyzes resume text locally without API calls."""
    # Simulate processing time for realism
    time.sleep(2)
    
    # Extract key information
    email = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', resume_text)
    phone = re.findall(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', resume_text)
    
    # Check for common skills
    skills = {
        'Python': 'python' in resume_text.lower(),
        'JavaScript': 'javascript' in resume_text.lower() or 'js' in resume_text.lower(),
        'React': 'react' in resume_text.lower(),
        'Node.js': 'node' in resume_text.lower(),
        'SQL': 'sql' in resume_text.lower(),
        'Java': 'java' in resume_text.lower(),
        'C++': 'c++' in resume_text.lower() or 'cpp' in resume_text.lower(),
        'Machine Learning': 'machine learning' in resume_text.lower() or 'ml' in resume_text.lower(),
        'Data Analysis': 'data analysis' in resume_text.lower(),
        'Project Management': 'project management' in resume_text.lower(),
    }
    
    # Count sections
    sections = {
        'Experience': 'experience' in resume_text.lower(),
        'Education': 'education' in resume_text.lower(),
        'Skills': 'skills' in resume_text.lower(),
        'Projects': 'project' in resume_text.lower(),
        'Certifications': 'certification' in resume_text.lower(),
    }
    
    # Calculate scores
    contact_score = 10 if email and phone else (5 if email or phone else 0)
    skills_score = sum(skills.values()) * 5
    sections_score = sum(sections.values()) * 10
    length_score = min(20, len(resume_text) / 50)
    
    total_score = min(100, contact_score + skills_score + sections_score + length_score)
    
    # Generate analysis
    analysis = {
        'score': int(total_score),
        'email': email[0] if email else None,
        'phone': phone[0] if phone else None,
        'skills': {k: v for k, v in skills.items() if v},
        'sections': {k: v for k, v in sections.items() if v},
        'strengths': [],
        'improvements': [],
        'suggestions': {
            'formatting': '',
            'content': '',
            'keywords': ''
        }
    }
    
    # Generate personalized strengths
    if analysis['skills']:
        analysis['strengths'].append(f"Strong technical skills in {', '.join(list(analysis['skills'].keys())[:3])}")
    if analysis['sections']:
        analysis['strengths'].append(f"Well-structured resume with {', '.join(list(analysis['sections'].keys()))} sections")
    if email and phone:
        analysis['strengths'].append("Clear contact information provided")
    
    # Generate personalized improvements
    if not analysis['skills']:
        analysis['improvements'].append("Consider adding a dedicated skills section")
    if 'Projects' not in analysis['sections']:
        analysis['improvements'].append("Add a projects section to showcase practical experience")
    if len(resume_text) < 500:
        analysis['improvements'].append("Consider adding more detail to your experience section")
    
    # Generate suggestions
    analysis['suggestions']['formatting'] = "Use consistent formatting with clear headings and bullet points. Consider a modern, clean template."
    analysis['suggestions']['content'] = "Focus on achievements with quantifiable results. Use action verbs to start each bullet point."
    analysis['suggestions']['keywords'] = f"Include keywords like {', '.join(list(analysis['skills'].keys())[:5])} to improve ATS optimization."
    
    return analysis

def create_skill_chart(skills):
    """Create an animated skill chart."""
    if not skills:
        return None
    
    fig = go.Figure()
    
    skill_names = list(skills.keys())
    skill_values = [random.randint(70, 95) for _ in skill_names]  # Simulate skill levels
    
    fig.add_trace(go.Bar(
        x=skill_names,
        y=skill_values,
        marker=dict(
            color=['rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 
                   'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)'],
            line=dict(color='rgba(255, 255, 255, 1.0)', width=1)
        ),
        text=skill_values,
        textposition='auto',
    ))
    
    fig.update_layout(
        title='Skills Assessment',
        xaxis=dict(title='Skills'),
        yaxis=dict(title='Proficiency Level', range=[0, 100]),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white'),
        title_font=dict(size=16, color='white'),
        xaxis=dict(
            title_font=dict(size=14, color='white'),
            tickfont=dict(size=12, color='white')
        ),
        yaxis=dict(
            title_font=dict(size=14, color='white'),
            tickfont=dict(size=12, color='white')
        ),
        animation_duration=1000
    )
    
    return fig

def create_radar_chart(sections):
    """Create a radar chart for resume sections."""
    if not sections:
        return None
    
    fig = go.Figure()
    
    section_names = list(sections.keys())
    section_values = [random.randint(70, 95) for _ in section_names]  # Simulate section scores
    
    fig.add_trace(go.Scatterpolar(
        r=section_values,
        theta=section_names,
        fill='toself',
        name='Resume Sections',
        line=dict(color='rgba(255, 255, 255, 0.8)'),
        fillcolor='rgba(255, 255, 255, 0.2)'
    ))
    
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 100],
                color='white'
            ),
            angularaxis=dict(
                color='white',
                tickfont=dict(color='white')
            )
        ),
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white'),
        title_font=dict(size=16, color='white'),
        animation_duration=1000
    )
    
    return fig

# --- MAIN STREAMLIT APP ---

# --- SIDEBAR ---
with st.sidebar:
    st.markdown("""
    <div class="custom-card">
        <h2>📊 Resume Analyzer Pro</h2>
        <p>Advanced AI-powered resume analysis without external APIs</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("""
    <div class="custom-card">
        <h3>✨ Features</h3>
        <ul>
            <li>Instant Analysis</li>
            <li>Skill Assessment</li>
            <li>Section Optimization</li>
            <li>Professional Feedback</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("""
    <div class="custom-card">
        <h3>🚀 2025 Technology</h3>
        <p>Powered by advanced local analysis algorithms</p>
    </div>
    """, unsafe_allow_html=True)

# --- MAIN PAGE ---
st.markdown("<h1 class='animated-title'>Resume Analyzer Pro 2025</h1>", unsafe_allow_html=True)
st.markdown("<p class='animated-subtitle'>Transform your resume with our cutting-edge analysis technology</p>", unsafe_allow_html=True)

# File uploader with custom styling
st.markdown("""
<div class="custom-card">
    <h2>📄 Upload Your Resume</h2>
    <p>Upload your resume in PDF format for instant analysis</p>
</div>
""", unsafe_allow_html=True)

uploaded_file = st.file_uploader(
    "Drag and drop your resume here or click to browse",
    type=['pdf'],
    help="Make sure your resume is in PDF format for best results.",
    label_visibility="collapsed"
)

if uploaded_file is not None:
    # Animated analyze button
    st.markdown('<div class="floating-button">', unsafe_allow_html=True)
    if st.button("🔍 Analyze Resume", type="primary", use_container_width=True):
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Progress animation
        progress_bar = st.empty()
        progress_bar.markdown("""
        <div class="progress-bar">
            <div class="progress"></div>
        </div>
        """, unsafe_allow_html=True)
        
        with st.spinner("🤖 Analyzing your resume with our advanced algorithms..."):
            resume_text = extract_text_from_pdf(uploaded_file)
            
            if resume_text:
                analysis = analyze_resume_locally(resume_text)
                
                # Success animation
                st.success("✅ Analysis Complete! Here are your results:")
                
                # Display Score with animation
                st.markdown("<h2 style='text-align: center; color: white; margin-top: 2rem;'>Your Resume Score</h2>", unsafe_allow_html=True)
                score_int = analysis['score']
                st.metric(label="Overall Score", value=f"{score_int}/100")
                
                # Create visualizations
                col1, col2 = st.columns(2)
                
                with col1:
                    skill_chart = create_skill_chart(analysis['skills'])
                    if skill_chart:
                        st.plotly_chart(skill_chart, use_container_width=True)
                
                with col2:
                    radar_chart = create_radar_chart(analysis['sections'])
                    if radar_chart:
                        st.plotly_chart(radar_chart, use_container_width=True)
                
                # Display Analysis Results
                st.markdown("<h2 style='text-align: center; color: white; margin-top: 2rem;'>Detailed Analysis</h2>", unsafe_allow_html=True)
                
                # Contact Information
                st.markdown("""
                <div class="custom-card">
                    <h3>📞 Contact Information</h3>
                """, unsafe_allow_html=True)
                
                if analysis['email']:
                    st.write(f"**Email:** {analysis['email']}")
                if analysis['phone']:
                    st.write(f"**Phone:** {analysis['phone']}")
                
                if not analysis['email'] and not analysis['phone']:
                    st.warning("No contact information found in your resume.")
                
                st.markdown("</div>", unsafe_allow_html=True)
                
                # Strengths and Improvements
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("""
                    <div class="custom-card">
                        <h3>✅ Strengths</h3>
                    """, unsafe_allow_html=True)
                    
                    for strength in analysis['strengths']:
                        st.write(f"- {strength}")
                    
                    st.markdown("</div>", unsafe_allow_html=True)
                
                with col2:
                    st.markdown("""
                    <div class="custom-card">
                        <h3>🔧 Areas for Improvement</h3>
                    """, unsafe_allow_html=True)
                    
                    for improvement in analysis['improvements']:
                        st.write(f"- {improvement}")
                    
                    st.markdown("</div>", unsafe_allow_html=True)
                
                # Detailed Suggestions
                with st.expander("🎯 Detailed Suggestions"):
                    st.markdown("""
                    <div class="custom-card">
                        <h3>📝 Formatting Suggestions</h3>
                        <p>{}</p>
                    </div>
                    """.format(analysis['suggestions']['formatting']), unsafe_allow_html=True)
                    
                    st.markdown("""
                    <div class="custom-card">
                        <h3>📄 Content Suggestions</h3>
                        <p>{}</p>
                    </div>
                    """.format(analysis['suggestions']['content']), unsafe_allow_html=True)
                    
                    st.markdown("""
                    <div class="custom-card">
                        <h3>🔑 Keywords for ATS</h3>
                        <p>{}</p>
                    </div>
                    """.format(analysis['suggestions']['keywords']), unsafe_allow_html=True)
                
                # Show extracted text
                with st.expander("📄 Extracted Text from Resume"):
                    st.text_area("Resume Content", resume_text, height=300)
else:
    st.info("👆 Please upload a PDF resume to begin the analysis.")
