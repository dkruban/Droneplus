# app.py

import streamlit as st
import openai
import io
import PyPDF2
import os

# --- PAGE CONFIGURATION ---
st.set_page_config(
    page_title="Resume Analyzer Pro",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- CUSTOM CSS FOR STYLING ---
st.markdown("""
<style>
/* Main app background */
.stApp {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Sidebar styling */
.css-1d391kg { /* This class targets the sidebar */
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
}

/* Main content area */
.stBlock {
    padding-top: 2rem;
    padding-bottom: 2rem;
}

/* Custom card component */
.custom-card {
    background-color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    padding: 1.5rem;
    border-radius: 10px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    margin-bottom: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Metric card styling */
div[data-testid="metric-container"] {
    background-color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 1rem;
    border-radius: 10px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    text-align: center;
}

/* Hiding streamlit default elements */
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {visibility: hidden;}
</style>
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

def analyze_resume_with_openai(resume_text, api_key):
    """Sends resume text to OpenAI for analysis."""
    openai.api_key = api_key
    
    prompt = f"""
    You are an expert career coach and an experienced Technical Recruiter. Analyze the following resume text.
    Provide a detailed analysis in the following format:

    **Overall Score (out of 100):** [A single number]

    **Summary:** [A 2-3 sentence summary of the candidate's profile and potential.]

    **Strengths:**
    - [Strength 1]
    - [Strength 2]
    - [Strength 3]

    **Areas for Improvement:**
    - [Improvement 1]
    - [Improvement 2]
    - [Improvement 3]

    **Specific Suggestions:**
    - **Formatting:** [Suggestion on layout, fonts, length, etc.]
    - **Content:** [Suggestion on what to add, remove, or rephrase.]
    - **Keywords:** [Suggest important keywords to add for better ATS (Applicant Tracking System) optimization.]

    Resume Text:
    ---
    {resume_text}
    ---
    """

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
        )
        return response.choices[0].message.content
    except Exception as e:
        st.error(f"An error occurred with the OpenAI API: {e}")
        return None

def parse_analysis(analysis_text):
    """Parses the structured text from OpenAI into a dictionary."""
    if not analysis_text:
        return {}
    
    data = {}
    try:
        lines = analysis_text.split('\n')
        current_key = None
        
        for line in lines:
            line = line.strip()
            if line.startswith("**Overall Score"):
                data['score'] = line.split(':')[-1].strip()
            elif line.startswith("**Summary:"):
                data['summary'] = line.split(':', 1)[-1].strip()
            elif line.startswith("**Strengths:"):
                current_key = 'strengths'
                data[current_key] = []
            elif line.startswith("**Areas for Improvement:"):
                current_key = 'improvements'
                data[current_key] = []
            elif line.startswith("**Specific Suggestions:"):
                current_key = 'suggestions'
                data[current_key] = {'formatting': '', 'content': '', 'keywords': ''}
            elif line.startswith("-") and current_key in ['strengths', 'improvements']:
                data[current_key].append(line[1:].strip())
            elif current_key == 'suggestions':
                if line.startswith("- **Formatting:**"):
                    data['suggestions']['formatting'] = line.split(':', 1)[-1].strip()
                elif line.startswith("- **Content:**"):
                    data['suggestions']['content'] = line.split(':', 1)[-1].strip()
                elif line.startswith("- **Keywords:**"):
                    data['suggestions']['keywords'] = line.split(':', 1)[-1].strip()
    except Exception as e:
        st.error(f"Error parsing AI response: {e}")
        return {'raw': analysis_text}

    return data

# --- MAIN STREAMLIT APP ---

# --- SIDEBAR ---
with st.sidebar:
    st.title("⚙️ App Info")
    st.info("This app is deployed on Render. Your API key is securely configured as an environment variable.")

# --- MAIN PAGE ---
st.markdown("<h1 style='text-align: center; color: white; padding: 1rem;'>Welcome to Resume Analyzer Pro 🚀</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align: center; color: white; font-size: 1.2rem;'>Upload your resume to get instant AI-powered feedback.</p>", unsafe_allow_html=True)

# Get API Key from Environment Variable (for Render/Production)
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    st.error("OpenAI API Key is not configured on the server. Please add it as an Environment Variable in Render.")
    st.stop()

# File uploader
uploaded_file = st.file_uploader(
    "📄 Upload your Resume (PDF only)",
    type=['pdf'],
    help="Make sure your resume is in PDF format for best results."
)

if uploaded_file is not None:
    if st.button("🔍 Analyze Resume", type="primary"):
        with st.spinner("🤖 AI is reading and analyzing your resume... Please wait."):
            resume_text = extract_text_from_pdf(uploaded_file)
            if resume_text:
                analysis_text = analyze_resume_with_openai(resume_text, api_key)
                if analysis_text:
                    parsed_data = parse_analysis(analysis_text)
                    st.success("Analysis Complete! Check out your results below.")
                    
                    if 'score' in parsed_data:
                        st.markdown(f"<h2 style='text-align: center; color: white;'>Your Resume Score</h2>", unsafe_allow_html=True)
                        score_int = int(parsed_data['score'])
                        st.metric(label="Overall Score", value=f"{score_int}/100")
                    
                    if 'summary' in parsed_data:
                        st.markdown("<div class='custom-card'>", unsafe_allow_html=True)
                        st.subheader("📝 Summary")
                        st.write(parsed_data['summary'])
                        st.markdown("</div>", unsafe_allow_html=True)

                    col1, col2 = st.columns(2)
                    with col1:
                        st.markdown("<div class='custom-card'>", unsafe_allow_html=True)
                        st.subheader("✅ Strengths")
                        if 'strengths' in parsed_data:
                            for strength in parsed_data['strengths']:
                                st.write(f"- {strength}")
                        st.markdown("</div>", unsafe_allow_html=True)

                    with col2:
                        st.markdown("<div class='custom-card'>", unsafe_allow_html=True)
                        st.subheader("🔧 Areas for Improvement")
                        if 'improvements' in parsed_data:
                            for improvement in parsed_data['improvements']:
                                st.write(f"- {improvement}")
                        st.markdown("</div>", unsafe_allow_html=True)
                    
                    with st.expander("🎯 Detailed Suggestions"):
                        if 'suggestions' in parsed_data:
                            st.markdown("**Formatting:**")
                            st.write(parsed_data['suggestions'].get('formatting', 'N/A'))
                            st.markdown("**Content:**")
                            st.write(parsed_data['suggestions'].get('content', 'N/A'))
                            st.markdown("**Keywords for ATS:**")
                            st.write(parsed_data['suggestions'].get('keywords', 'N/A'))
                        elif 'raw' in parsed_data:
                             st.write(parsed_data['raw'])

                    with st.expander("📄 Extracted Text from Resume"):
                        st.text_area("Resume Content", resume_text, height=300)

else:
    st.info("👆 Please upload a PDF resume to begin the analysis.")
