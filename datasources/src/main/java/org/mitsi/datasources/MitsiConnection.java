package org.mitsi.datasources;

import java.io.Closeable;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.ResultContext;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.TransactionFactory;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.apache.log4j.Logger;
import org.mitsi.datasources.exceptions.MitsiDatasourceException;
import org.mitsi.datasources.helper.TypeHelper;
import org.mitsi.datasources.mapper.oracle.IOracleMapper;

public class MitsiConnection implements Closeable {
	private static final Logger log = Logger.getLogger(MitsiConnection.class);

	MitsiDatasource datasource;
	//Connection connection = null;
	DataSource jdbcDataSource = null;
	SqlSessionFactory sqlSessionFactory = null;
	SqlSession sqlSession = null;
	IMitsiMapper mapper = null;
	PreparedStatement currentStatement = null; // TODO : permettre d'ouvrir plusieurs statements, un par page/tabulation/autre chose ?
	ResultSet currentResultSet = null;// TODO : permettre d'ouvrir plusieurs statements, un par page/tabulation/autre chose ?
	//int currentResultSetNbColumns = 0;
	int [] currentResultSetJdbTypes = null;
	
	public MitsiConnection(MitsiDatasource datasource) {
		this.datasource = datasource;
	}
	
	public MitsiDatasource getDatasource() {
		return datasource;
	}
	
	
	public void connect() throws SQLException, ClassNotFoundException {
		//Class.forName(datasource.getDriver());
		//connection = DriverManager.getConnection(
		//		datasource.getJdbcUrl(),
		//		datasource.getUser(),
		//		datasource.getPassword());
		jdbcDataSource = new UnpooledDataSource(datasource.getDriver(), 
				datasource.getJdbcUrl(), datasource.getUser(), datasource.getPassword());
		//connection = jdbcDataSource.getConnection();

		TransactionFactory transactionFactory = new JdbcTransactionFactory();
		/* TODO : vérifier à quoi sert le nom de l'environment */
		Environment environment = new Environment(datasource.getName(), transactionFactory, jdbcDataSource);
		Configuration configuration = new Configuration(environment);
		configuration.setCacheEnabled(false);
		//configuration.addMappers("mapper.oracle");
		// TODO : a rajouter
		// configuration.addMapper(BlogMapper.class);
		sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
		sqlSessionFactory.getConfiguration().addMapper(IOracleMapper.class);
		sqlSession = sqlSessionFactory.openSession();
		mapper = sqlSession.getMapper(IOracleMapper.class);
		if(datasource.getConnectSchema() != null && !datasource.getConnectSchema().isEmpty()) {
			mapper.changeSchema(datasource.getConnectSchema());
		}
	}
	
	public void clearCache() {
		sqlSession.clearCache();
	}
	
	@Override
	public void close() {
		//if(connection != null) {
		//	try {
		//		connection.close();
		//	} catch (SQLException e) {
		//		// nothing
		//	}
		//}
		
		sqlSession.close();
		sqlSession = null;
		mapper = null;
	}
	
	public IMitsiMapper getMapper() {
		return mapper;
	}

	public void rollback() {
		sqlSession.rollback();
		
	}
	public void commit() {
		sqlSession.commit();
		
	}
	
	
	public List<Column> rawSelectBegin(String sql) throws SQLException, MitsiDatasourceException { // TODO : parameters
		if(currentResultSet != null) {
			rawSelectEndQuietly();
		}
		
		// back to JDBC
		Connection jdbcConnection = sqlSession.getConnection();
		currentStatement  = jdbcConnection.prepareStatement(sql);
		if(!currentStatement.execute()) {
			throw new MitsiDatasourceException("not a SELECT : '"+sql+"'");
		}
		
		currentResultSet = currentStatement.getResultSet();
		ResultSetMetaData rsmd = currentResultSet.getMetaData();
		List<Column> columns = new ArrayList<Column>();
		//currentResultSetNbColumns = rsmd.getColumnCount();
		currentResultSetJdbTypes = new int[rsmd.getColumnCount()];
		for(int i=0; i!=rsmd.getColumnCount(); i++) {
			Column column = new Column();
			currentResultSetJdbTypes[i] =  rsmd.getColumnType(i+1);
			column.type = TypeHelper.getTypeFromJdbc(rsmd.getColumnType(i+1));
			column.name = rsmd.getColumnName(i+1);
			// TODO : précision ? possible ?
			columns.add(column);
		}
		return columns;
	}
	
	public List<String[]> rawSelectFetch(int nbRowToFetch) throws SQLException, MitsiDatasourceException { 
		// TODO : renvoyer autre chose que des strings pour gérer les blogs, long, etc.
		if(currentStatement == null) {
			throw new MitsiDatasourceException("no current statement for connection");
		}
		
		List<String[]> results = new ArrayList<String[]>();
		while(nbRowToFetch>0 && currentResultSet.next() ) {
			nbRowToFetch--;
			String[] result = new String[currentResultSetJdbTypes.length];
			for(int i=0; i!=currentResultSetJdbTypes.length; i++) {
				result[i] = TypeHelper.fromJdbcToString(currentResultSetJdbTypes[i], currentResultSet, i+1);
			}
			results.add(result);
		}
		return results;
	}
	
	public void rawSelectEnd() throws SQLException, MitsiDatasourceException {
		if(currentStatement == null) {
			throw new MitsiDatasourceException("no current statement for connection");
		}

		currentResultSet.close();
		currentStatement.close();
		currentResultSet = null;
		currentStatement = null;
		//currentResultSetNbColumns = 0;
		currentResultSetJdbTypes = null;
	}
	
	public void rawSelectEndQuietly()   {
		
			if(currentResultSet != null) {
				try {
					currentResultSet.close();
				} catch (SQLException e) {
					// quiet
				}
			}
			if(currentStatement != null) {
				try {
					currentStatement.close();
				} catch (SQLException e) {
					// quiet
				}
			}
			//currentResultSetNbColumns = 0;
			currentResultSetJdbTypes = null;

	}
	
	/*public void testOK() {
		//boolean ret = false;
		//try {
			//String str = sqlSession.selectOne("testOK" /*"mapper.oracle.testOK"* /);
			String str = mapper.testOK();
			if(str != null) {
				log.debug("mapper.testOK : '"+str+"'");
				//ret = true;
			}
			
			//Statement stmt = connection.createStatement();
			//ResultSet rs = stmt.executeQuery("select 1 from dual");
			
			//if(rs.next()) {
			//	ret = true;
			//}
			
		//} catch(Exception e) {
		//	e.printStackTrace();
		//	ret = false;
		//}
		//return ret;
	}*/

	/* TODO 
	public List<DatabaseObject> getTables() {
		
	}
	public List<DatabaseObject> getTablesAndColumns() {
		
	}
	public List<DatabaseObject> getTablesAndLinkedObjets() {
		
	}
	public List<DatabaseObject> getUserObjets() {
		
	}
	public List<DatabaseObject> getAllObjets() {
		
	}
	*/
	
	/*public List<DatabaseObject> getTablesAndViews() {
		return mapper.getTablesAndViews();
	}*/
	
}
