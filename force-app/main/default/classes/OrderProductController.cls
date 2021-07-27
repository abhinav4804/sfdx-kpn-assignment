public with sharing class OrderProductController {

    public static final string ACTIVATED = 'Activated'; 
    public static final Integer STATUS_CODE_200 = 200;
    /*
    Method name:- orderProducts
    Parameters:- 
    Description:- 
    */
    @AuraEnabled
    public static List<OrderItem> orderProducts(String orderId){
        List<OrderItem> orderProductsList = new List<OrderItem>();
        try {
            //Get the list of already added Products based on the Order
            orderProductsList = [Select Id, Product2Id, Product2.Name, UnitPrice, Quantity, TotalPrice FROM OrderItem WHERE OrderId =: orderId];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }

        return orderProductsList;
    }

    @AuraEnabled
    public static void activateOrder(String orderId){
        try {
            Order orderRec = new Order();
            orderRec.Id = orderId;
            orderRec.Status = ACTIVATED;
            update orderRec;

            confirmOrderonExternalSystem(orderId);

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    @future(callout=true)
    public static void confirmOrderonExternalSystem(String orderId){

        List<Order> orderList = [Select OrderNumber, Type, Status, Account.AccountNumber,
                                        (Select Product2.Name, Product2.ProductCode, UnitPrice, Quantity
                                            FROM OrderItems)
                                    FROM ORDER WHERE Id =:orderId];
        
        if(!orderList.isEmpty()){
            CreateRequest createRequest = new CreateRequest(orderList[0]);
            if(createRequest != null){
               performCallout(createRequest);
            }
        }                            
    }

    public static void performCallout(CreateRequest createRequest){

        Http http = new Http();
        HttpRequest request = new HttpRequest();
        request.setEndpoint('https://gaurav-kpn.requestcatcher.com/');
        request.setMethod('POST');
        request.setBody(JSON.serialize(createRequest));
        HttpResponse response = http.send(request);

        if(response.getStatusCode() == STATUS_CODE_200){
            system.debug('***Successful Callout');
        }else{
            system.debug('***Error in the callout' );
            //Capture error with the details to identify the root cause
        }
    }       

    public class CreateRequest{
        public string accountNumber;
        public string orderNumber;
        public string type;
        public string status;
        public List<OrderProducts> orderProducts;

        public CreateRequest(Order orderRecord){
            this.accountNumber = orderRecord.Account.AccountNumber;
            this.orderNumber = orderRecord.OrderNumber;
            this.type = orderRecord.Type;
            this.Status = orderRecord.Status;
            this.orderProducts = new List<OrderProducts>();
            for(OrderItem oItem : orderRecord.OrderItems){
                this.orderProducts.add(new OrderProducts(oItem));
            }
        }

    }

    public class OrderProducts{
        public string name;
        public string code;
        public Decimal unitPrice;
        public Decimal quantity;

        public OrderProducts(OrderItem oItemRecord){
            this.name = oItemRecord.Product2.Name;
            this.code = oItemRecord.Product2.ProductCode;
            this.unitPrice = oItemRecord.UnitPrice;
            this.quantity = oItemRecord.Quantity;
        }

    }

    public class ResponseWrapper{
       public String Status;
       public Integer StatusCode;
    }
}