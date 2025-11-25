import requests
from bs4 import BeautifulSoup
import json
import time
import re
from typing import List, Dict, Any

class UniversityScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def scrape_page(self, url: str) -> Dict[str, Any]:
        """Enhanced scraping with better table extraction"""
        try:
            print(f"🕸️  Scraping: {url}")
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract comprehensive data
            data = {
                'url': url,
                'title': self.get_title(soup),
                'content': self.get_clean_content(soup),
                'tables': self.extract_tables_with_context(soup),
                'metadata': self.get_page_metadata(soup),
                'scraped_at': time.strftime("%Y-%m-%d %H:%M:%S"),
                'status': 'success'
            }
            
            print(f"✅ Success: {url}")
            return data
            
        except Exception as e:
            print(f"❌ Failed: {url} - {str(e)}")
            return {
                'url': url,
                'status': 'failed',
                'error': str(e)
            }
    
    def get_clean_content(self, soup) -> str:
        """Extract and clean main content"""
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header']):
            element.decompose()
        
        # Get text and clean it
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        return ' '.join(chunk for chunk in chunks if chunk)
    
    def extract_tables_with_context(self, soup) -> List[Dict]:
        """Extract tables with surrounding context"""
        tables_data = []
        
        for table in soup.find_all('table'):
            table_context = self.get_table_context(table)
            rows = []
            
            for row in table.find_all('tr'):
                cells = [cell.get_text().strip() for cell in row.find_all(['td', 'th'])]
                if cells and any(cell for cell in cells):
                    rows.append(cells)
            
            if rows:
                tables_data.append({
                    'context': table_context,
                    'rows': rows,
                    'row_count': len(rows),
                    'column_count': max(len(row) for row in rows) if rows else 0
                })
        
        return tables_data
    
    def get_table_context(self, table) -> str:
        """Get text around table for context"""
        context_elements = []
        
        # Get previous heading
        prev_heading = table.find_previous(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        if prev_heading:
            context_elements.append(f"Heading: {prev_heading.get_text().strip()}")
        
        # Get previous paragraph
        prev_para = table.find_previous('p')
        if prev_para and prev_para != prev_heading:
            context_elements.append(f"Context: {prev_para.get_text().strip()[:200]}...")
        
        return ' | '.join(context_elements)
    
    def get_page_metadata(self, soup) -> Dict:
        """Extract page metadata"""
        metadata = {
            'title': self.get_title(soup),
            'description': '',
            'keywords': []
        }
        
        # Meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            metadata['description'] = meta_desc.get('content', '')
        
        # Keywords
        meta_keys = soup.find('meta', attrs={'name': 'keywords'})
        if meta_keys:
            metadata['keywords'] = [k.strip() for k in meta_keys.get('content', '').split(',')]
        
        return metadata

    def get_title(self, soup):
        """Extract page title"""
        title = soup.find('title')
        return title.get_text().strip() if title else "No title"