import pandas as pd
import json
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Set Plot Style
plt.style.use('dark_background')
sns.set_palette(['#FFCC00', '#FFFFFF', '#808080']) # MTN Yellow, White, Grey

# File Paths
input_file = r'c:/Users/Godwin Akachukwu/Downloads/MTN customers dataset/mtn_customer_churn.csv'
output_json = r'c:/Users/Godwin Akachukwu/Downloads/MTN customers dataset/dashboard/data_summary.json'
output_js_data = r'c:/Users/Godwin Akachukwu/Downloads/MTN customers dataset/dashboard/data.js'
output_sql = r'c:/Users/Godwin Akachukwu/Downloads/MTN customers dataset/analysis.sql'
images_dir = r'c:/Users/Godwin Akachukwu/Downloads/MTN customers dataset/dashboard/images'

# Ensure directories exist
os.makedirs(os.path.dirname(output_json), exist_ok=True)
os.makedirs(images_dir, exist_ok=True)

def load_data():
    try:
        df = pd.read_csv(input_file)
        # Basic Cleaning
        df.columns = [c.strip() for c in df.columns]
        # Remove currency symbols if any and convert to numeric
        if df['Total Revenue'].dtype == 'object':
             df['Total Revenue'] = df['Total Revenue'].replace('[^\d.]', '', regex=True).astype(float)
        return df
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

def generate_sql(df):
    print("Generating SQL script...")
    create_table_query = """
CREATE TABLE MtnCustomers (
    Customer_ID VARCHAR(50),
    Full_Name VARCHAR(100),
    Date_of_Purchase VARCHAR(50),
    Age INT,
    State VARCHAR(50),
    MTN_Device VARCHAR(50),
    Gender VARCHAR(10),
    Satisfaction_Rate INT,
    Customer_Review VARCHAR(50),
    Customer_Tenure_Months INT,
    Subscription_Plan VARCHAR(100),
    Unit_Price DECIMAL(10, 2),
    Number_of_Times_Purchased INT,
    Total_Revenue DECIMAL(10, 2),
    Data_Usage DECIMAL(10, 2),
    Customer_Churn_Status VARCHAR(10),
    Reasons_for_Churn VARCHAR(255)
);
"""
    insert_statements = []
    
    # Selecting columns to match the table schema (ordered)
    cols = ['Customer ID', 'Full Name', 'Date of Purchase', 'Age', 'State', 
            'MTN Device', 'Gender', 'Satisfaction Rate', 'Customer Review', 
            'Customer Tenure in months', 'Subscription Plan', 'Unit Price', 
            'Number of Times Purchased', 'Total Revenue', 'Data Usage', 
            'Customer Churn Status', 'Reasons for Churn']
    
    for _, row in df.iterrows():
        values = []
        for col in cols:
            val = row[col]
            if pd.isna(val):
                values.append("NULL")
            elif isinstance(val, str):
                safe_val = val.replace("'", "''") # Escape single quotes
                values.append(f"'{safe_val}'")
            else:
                values.append(str(val))
        
        insert_statements.append(f"INSERT INTO MtnCustomers VALUES ({', '.join(values)});")
    
    analytical_queries = """
-- 1. Churn Rate
SELECT 
    (COUNT(CASE WHEN Customer_Churn_Status = 'Yes' THEN 1 END) * 100.0 / COUNT(*)) as Churn_Rate
FROM MtnCustomers;

-- 2. Total Revenue by State
SELECT State, SUM(Total_Revenue) as Total_Revenue
FROM MtnCustomers
GROUP BY State
ORDER BY Total_Revenue DESC;

-- 3. Average Satisfaction by Device
SELECT MTN_Device, AVG(Satisfaction_Rate) as Avg_Satisfaction
FROM MtnCustomers
GROUP BY MTN_Device;

-- 4. Top 5 Reasons for Churn
SELECT Reasons_for_Churn, COUNT(*) as Count
FROM MtnCustomers
WHERE Customer_Churn_Status = 'Yes'
GROUP BY Reasons_for_Churn
ORDER BY Count DESC
LIMIT 5;
"""
    
    with open(output_sql, 'w') as f:
        f.write("-- Schema Creation\n")
        f.write(create_table_query + "\n")
        f.write("-- Data Population\n")
        f.write('\n'.join(insert_statements) + "\n")
        f.write("-- Analytical Queries\n")
        f.write(analytical_queries)
    print(f"SQL script saved to {output_sql}")

def analyze_and_visualize(df):
    summary = {}

    # Export Raw Data for Client-Side Interactivity
    # Convert DataFrame to dict (records)
    # Handle NaN values which JSON doesn't like (replace with None or empty string)
    df_json = df.fillna('').to_dict(orient='records')
    summary['raw_data'] = df_json

    # We still keep the pre-calculated metrics for the initial view or mainly for the Static Reports
    # But strictly speaking, the Frontend could calculate everything now.
    # Let's keep the image generation code as is for the Static Visuals requirement.

    # 1. Re-calculate aggregations for static plots
    churn_dist = df['Customer Churn Status'].value_counts().to_dict()
    summary['churn_distribution'] = churn_dist # Add to summary for legacy support
    
    # Static Plot 1: Churn Distribution
    plt.figure(figsize=(6, 6))
    plt.pie(churn_dist.values(), labels=churn_dist.keys(), autopct='%1.1f%%', 
            colors=['#FFCC00', '#333333'], textprops={'color':"w"})
    plt.title('Customer Churn Distribution', color='white')
    plt.savefig(os.path.join(images_dir, 'churn_distribution.png'))
    plt.close()

    # 2. Revenue by State (Bar Chart) -> JSON Data
    rev_by_state = df.groupby('State')['Total Revenue'].sum().sort_values(ascending=False).head(10)
    summary['revenue_by_state'] = {
        'labels': rev_by_state.index.tolist(),
        'data': rev_by_state.values.tolist()
    }
    
    # Static Plot 2: Revenue by State
    plt.figure(figsize=(10, 6))
    colors = ['#FFCC00' if i < 3 else '#333333' for i in range(len(rev_by_state))]
    ax = sns.barplot(x=rev_by_state.index, y=rev_by_state.values, palette=colors)
    plt.title('Top 10 States by Revenue', color='white')
    plt.xticks(rotation=45, color='white')
    plt.yticks(color='white')
    plt.ylabel('Revenue', color='white')
    
    # Add percentage labels
    total_rev_plot = rev_by_state.sum()
    for p in ax.patches:
        height = p.get_height()
        if height > 0:
            percentage = (height / total_rev_plot) * 100
            ax.text(p.get_x() + p.get_width() / 2., height + (height * 0.01),
                    f'{percentage:.1f}%', ha="center", color='white', fontsize=10)

    plt.tight_layout()
    plt.savefig(os.path.join(images_dir, 'revenue_by_state.png'))
    plt.close()

    # 3. Satisfaction by Device (Bar Chart) -> JSON Data
    sat_by_device = df.groupby('MTN Device')['Satisfaction Rate'].mean().sort_values(ascending=False)
    summary['satisfaction_by_device'] = {
        'labels': sat_by_device.index.tolist(),
        'data': [round(x, 2) for x in sat_by_device.values.tolist()]
    }

    # Static Plot 3: Satisfaction by Device
    plt.figure(figsize=(8, 5))
    ax = sns.barplot(x=sat_by_device.index, y=sat_by_device.values, color='#FFCC00')
    plt.title('Avg Satisfaction by Device', color='white')
    plt.xticks(color='white')
    plt.yticks(color='white')
    plt.ylim(0, 5.5) # Increase limit for text
    
    # Add percentage labels (Score / 5)
    for p in ax.patches:
        height = p.get_height()
        if height > 0:
            percentage = (height / 5.0) * 100
            ax.text(p.get_x() + p.get_width() / 2., height + 0.1,
                    f'{percentage:.0f}%', ha="center", color='white', fontsize=10)
    
    plt.tight_layout()
    plt.savefig(os.path.join(images_dir, 'satisfaction_by_device.png'))
    plt.close()

    # 4. Churn Reasons (Horizontal Bar) -> JSON Data
    churn_reasons = df[df['Customer Churn Status'] == 'Yes']['Reasons for Churn'].value_counts()
    summary['churn_reasons'] = {
        'labels': churn_reasons.index.tolist(),
        'data': churn_reasons.values.tolist()
    }

    # Static Plot 4: Churn Reasons
    plt.figure(figsize=(10, 6))
    ax = sns.barplot(y=churn_reasons.index, x=churn_reasons.values, color='#808080')
    plt.title('Reasons for Churn', color='white')
    plt.xticks(color='white')
    plt.yticks(color='white')

    # Add percentage labels
    total_churn_plot = churn_reasons.sum()
    for p in ax.patches:
        width = p.get_width()
        if width > 0:
            percentage = (width / total_churn_plot) * 100
            ax.text(width + 1, p.get_y() + p.get_height() / 2.,
                    f'{percentage:.1f}%', va="center", color='white', fontsize=10)

    plt.tight_layout()
    plt.savefig(os.path.join(images_dir, 'churn_reasons.png'))
    plt.close()

    # Save Summary JSON (Legacy)
    with open(output_json, 'w') as f:
        json.dump(summary, f, indent=4)
    print(f"Data summary saved to {output_json}")

    # Save as JS file for local CORS compatibility
    with open(output_js_data, 'w') as f:
        json_str = json.dumps(summary, indent=4)
        f.write(f"const dashboardData = {json_str};")
    print(f"Data JS saved to {output_js_data}")

if __name__ == "__main__":
    df = load_data()
    if df is not None:
        generate_sql(df)
        analyze_and_visualize(df)
        print("Analysis Complete.")
